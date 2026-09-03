from django.contrib import admin
from .models import Task


@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = ('id', 'title', 'owner', 'status', 'priority', 'due_date', 'created_at')
    ordering = ('-created_at',)