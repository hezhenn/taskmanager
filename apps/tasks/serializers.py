from rest_framework import serializers
from .models import Task

class TaskSerializer(serializers.ModelSerializer):

    owner = serializers.ReadOnlyField(source='owner.username')
    owner_id = serializers.ReadOnlyField(source='owner.id')

    class Meta:
        model = Task
        fields = ('id', 'title', 'description', 'status', 'priority',
                  'due_date','owner', 'owner_id', 'created_at', 'updated_at')

        read_only_fields = ('id', 'owner', 'owner_id', 'created_at', 'updated_at')

    def validate_title(self, value):

        stripped = value.strip()
        if not stripped:
            raise serializers.ValidationError('Task title cannot be blank or whitespace')
        return stripped