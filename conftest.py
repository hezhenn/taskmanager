import pytest
from django.core.cache import cache


@pytest.fixture(autouse=True)
def clear_cache_between_tests():
    """Ensure every test runs with an empty cache."""
    cache.clear()
    yield
    cache.clear()
