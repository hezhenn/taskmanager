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

    def get_ident(self, request):
        """
        Identify the client IP address accurately behind reverse proxies (Nginx, Docker, Cloudflare).
        Prioritizes HTTP_X_REAL_IP if present, otherwise parses the original client IP from
        HTTP_X_FORWARDED_FOR, falling back to REMOTE_ADDR.
        """
        x_real_ip = request.META.get('HTTP_X_REAL_IP')
        if x_real_ip:
            return x_real_ip.strip()

        xff = request.META.get('HTTP_X_FORWARDED_FOR')
        if xff:
            return xff.split(',')[0].strip()

        return super().get_ident(request)
