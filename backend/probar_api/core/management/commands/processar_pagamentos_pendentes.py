import logging
import os

from django.conf import settings
from django.core.management.base import BaseCommand

from core.services.stripe_service import processar_pagamentos_pendentes


class Command(BaseCommand):
    help = "Processa pagamentos pendentes para captura automatica."

    def handle(self, *args, **options):
        logger = self._get_logger()
        logger.info("Processamento iniciado")

        stats = processar_pagamentos_pendentes(logger=logger)

        logger.info(
            "Processamento concluido total=%s captured=%s skipped=%s errors=%s",
            stats["total"],
            stats["captured"],
            stats["skipped"],
            stats["errors"],
        )

        self.stdout.write(
            self.style.SUCCESS(
                "Processamento concluido. "
                f"total={stats['total']} "
                f"captured={stats['captured']} "
                f"skipped={stats['skipped']} "
                f"errors={stats['errors']}"
            )
        )

    def _get_logger(self):
        logger = logging.getLogger("pagamentos_cron")
        if logger.handlers:
            return logger

        logger.setLevel(logging.INFO)

        log_dir = os.path.join(settings.BASE_DIR, "logs")
        os.makedirs(log_dir, exist_ok=True)

        log_path = os.path.join(log_dir, "pagamentos_cron.log")
        handler = logging.FileHandler(log_path, encoding="utf-8")
        formatter = logging.Formatter("%(asctime)s %(levelname)s %(message)s")
        handler.setFormatter(formatter)

        logger.addHandler(handler)
        return logger
