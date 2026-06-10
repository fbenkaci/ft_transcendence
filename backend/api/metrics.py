# backend/api/metrics.py
from django.http import HttpResponse
from prometheus_client import generate_latest, CONTENT_TYPE_LATEST, Counter, Gauge

REQUESTS = Counter("transcendence_requests_total", "Total number of requests")
BACKEND_UP = Gauge("transcendence_backend_up", "Backend health flag")

def metrics_view(request):
    REQUESTS.inc()
    BACKEND_UP.set(1)
    return HttpResponse(generate_latest(), content_type=CONTENT_TYPE_LATEST)