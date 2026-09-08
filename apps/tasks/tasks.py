import logging
from celery import shared_task
from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone
from .models import Task

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_task_high_priority_alert(self, task_id):
    """
    Sends an immediate email notification when a high-priority task is created.
    """
    try:
        task = Task.objects.select_related('owner').get(id=task_id)
    except Task.DoesNotExist:
        logger.warning(f"Task #{task_id} not found for high-priority alert.")
        return f"Task #{task_id} not found"

    recipient = task.owner.email
    if not recipient:
        logger.info(f"Owner of task #{task_id} has no email configured.")
        return f"No email for task #{task_id} owner"

    subject = f"[TaskFlow Alert] High Priority Task: {task.title}"
    message = (
        f"Hello {task.owner.username},\n\n"
        f"A high-priority task has been registered in your workspace:\n\n"
        f"• Title: {task.title}\n"
        f"• Status: {task.get_status_display()}\n"
        f"• Due Date: {task.due_date or 'No deadline'}\n\n"
        f"Log in to TaskFlow to manage your workload.\n\n"
        f"— TaskFlow Notifications"
    )

    try:
        send_mail(
            subject=subject,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[recipient],
            fail_silently=False,
        )
        logger.info(f"High-priority alert sent to {recipient} for task #{task_id}")
        return f"Alert sent to {recipient}"
    except Exception as exc:
        logger.error(f"Error sending email for task #{task_id}: {exc}")
        raise self.retry(exc=exc)


@shared_task(bind=True)
def send_overdue_tasks_digest(self):
    """
    Periodic task run via Celery Beat to find all overdue tasks and
    dispatch reminder digests to respective task owners.
    """
    now = timezone.now()
    overdue_tasks = Task.objects.filter(
        due_date__lt=now,
    ).exclude(
        status=Task.Status.DONE,
    ).select_related('owner')

    # Group by owner
    user_tasks_map = {}
    for task in overdue_tasks:
        user = task.owner
        if user not in user_tasks_map:
            user_tasks_map[user] = []
        user_tasks_map[user].append(task)

    processed_users = 0
    total_overdue = 0

    for user, tasks in user_tasks_map.items():
        total_overdue += len(tasks)
        if not user.email:
            continue

        task_lines = "\n".join([f"• {t.title} (due: {t.due_date.strftime('%Y-%m-%d %H:%M')})" for t in tasks[:10]])
        if len(tasks) > 10:
            task_lines += f"\n... and {len(tasks) - 10} more."

        subject = f"[TaskFlow] Overdue Tasks Digest: {len(tasks)} task(s) require attention"
        message = (
            f"Hello {user.username},\n\n"
            f"You currently have {len(tasks)} task(s) past their scheduled deadline:\n\n"
            f"{task_lines}\n\n"
            f"Please visit your TaskFlow dashboard to review and complete them.\n\n"
            f"— TaskFlow Daily Digest"
        )

        try:
            send_mail(
                subject=subject,
                message=message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[user.email],
                fail_silently=False,
            )
            processed_users += 1
            logger.info(f"Overdue digest sent to {user.email} ({len(tasks)} tasks)")
        except Exception as exc:
            logger.error(f"Failed to send overdue digest to {user.email}: {exc}")

    summary = {
        'processed_users': processed_users,
        'total_overdue': total_overdue,
    }
    logger.info(f"Overdue digest completed: {summary}")
    return summary
