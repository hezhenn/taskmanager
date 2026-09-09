from rest_framework.settings import api_settings
from rest_framework.throttling import ScopedRateThrottle


class DynamicScopedRateThrottle(ScopedRateThrottle):
    """
    A ScopedRateThrottle that reads rates dynamically from api_settings.DEFAULT_THROTTLE_RATES.
    This enables dynamic rate changes via environment variables or override_settings during testing.
    """

    def get_rate(self):
        if not getattr(self, 'scope', None):
            return super().get_rate()
        rates = api_settings.DEFAULT_THROTTLE_RATES
        return rates.get(self.scope)
