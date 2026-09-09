from django.core.cache import cache
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver
from .models import Task


@receiver([post_save, post_delete], sender=Task)
def invalidate_task_statistics_cache(sender, instance, **kwargs):
    """
    Invalidate cached statistics for the task's owner whenever a task
    is created, updated, or deleted.
    """
    if instance.owner_id:
        cache_key = f"taskflow:user:{instance.owner_id}:statistics"
        cache.delete(cache_key)
