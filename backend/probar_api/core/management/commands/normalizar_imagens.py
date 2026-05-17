from django.core.management.base import BaseCommand

from core.models import Bartender, Cliente, Drink
from core.services.image_processing import (
    DRINK_IMAGE_SIZE,
    PROFILE_IMAGE_SIZE,
    image_field_is_normalized,
    normalize_committed_image_field,
)


class Command(BaseCommand):
    help = "Normaliza imagens ja salvas para os tamanhos padrao do app."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Mostra o que seria feito sem gravar alteracoes.",
        )
        parser.add_argument(
            "--clear-missing",
            action="store_true",
            help="Remove do banco as referencias para arquivos que nao existem mais.",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        clear_missing = options["clear_missing"]
        normalizadas = 0
        normalizaveis = 0
        ja_normalizadas = 0
        ausentes = 0
        limpas = 0
        failures = 0

        targets = [
            (
                Cliente.objects.filter(foto_perfil__isnull=False).exclude(foto_perfil=""),
                "foto_perfil",
                PROFILE_IMAGE_SIZE,
                "cover",
                False,
                None,
                "clientes",
            ),
            (
                Bartender.objects.filter(foto_perfil__isnull=False).exclude(foto_perfil=""),
                "foto_perfil",
                PROFILE_IMAGE_SIZE,
                "cover",
                False,
                None,
                "bartenders",
            ),
            (
                Drink.objects.filter(foto__isnull=False).exclude(foto=""),
                "foto",
                DRINK_IMAGE_SIZE,
                "cover",
                True,
                0.2,
                "drinks",
            ),
        ]

        for (
            queryset,
            field_name,
            size,
            fit,
            trim_uniform_border,
            min_content_ratio,
            label,
        ) in targets:
            for instance in queryset.iterator():
                field_file = getattr(instance, field_name)
                if not field_file:
                    continue

                if not field_file.storage.exists(field_file.name):
                    ausentes += 1
                    if clear_missing and not dry_run:
                        setattr(instance, field_name, None)
                        instance.save(update_fields=[field_name, "atualizado_em"])
                        limpas += 1
                    continue

                try:
                    if image_field_is_normalized(
                        field_file,
                        size=size,
                        min_content_ratio=min_content_ratio,
                    ):
                        ja_normalizadas += 1
                        continue
                except Exception as exc:
                    failures += 1
                    self.stderr.write(
                        f"Falha ao ler {label} #{instance.pk}: {exc}"
                    )
                    continue

                if dry_run:
                    normalizaveis += 1
                    continue

                try:
                    normalize_committed_image_field(
                        instance,
                        field_name,
                        size=size,
                        fit=fit,
                        trim_uniform_border=trim_uniform_border,
                    )
                    normalizadas += 1
                except Exception as exc:
                    failures += 1
                    self.stderr.write(
                        f"Falha ao normalizar {label} #{instance.pk}: {exc}"
                    )

        if dry_run:
            self.stdout.write(f"{normalizaveis} imagens seriam normalizadas.")
            self.stdout.write(f"{ja_normalizadas} imagens ja estao normalizadas.")
            self.stdout.write(f"{ausentes} referencias apontam para arquivos ausentes.")
            if clear_missing and ausentes:
                self.stdout.write(
                    f"{ausentes} referencias ausentes seriam limpas do banco."
                )
            return

        self.stdout.write(
            self.style.SUCCESS(
                f"{normalizadas} imagens normalizadas. "
                f"{ja_normalizadas} ja estavam normalizadas. "
                f"{ausentes} ausentes. "
                f"{limpas} referencias limpas. "
                f"Falhas: {failures}."
            )
        )
