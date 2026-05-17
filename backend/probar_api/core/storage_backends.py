from urllib.parse import quote

from django.conf import settings
from storages.backends.s3 import S3Storage


class SupabaseMediaStorage(S3Storage):
    file_overwrite = False
    querystring_auth = False
    default_acl = None

    def url(self, name, parameters=None, expire=None, http_method=None):
        public_url = getattr(settings, "SUPABASE_PUBLIC_STORAGE_URL", "").rstrip("/")
        if not public_url:
            return super().url(name, parameters=parameters, expire=expire, http_method=http_method)

        path = quote(str(name).lstrip("/"), safe="/")
        return f"{public_url}/{path}"
