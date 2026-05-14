from pathlib import Path

from django.conf import settings
from django.core.files import File
from django.core.files.storage import default_storage
from django.core.management.base import BaseCommand

from core.models import Bartender, Cliente, Drink


class Command(BaseCommand):
    help = "Migra arquivos locais de MEDIA_ROOT para o storage configurado no Django."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Mostra o que seria migrado sem enviar arquivos.",
        )
        parser.add_argument(
            "--overwrite",
            action="store_true",
            help="Substitui arquivos que ja existem no storage remoto.",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        overwrite = options["overwrite"]
        media_root = Path(settings.MEDIA_ROOT)
        storage_label = f"{default_storage.__class__.__module__}.{default_storage.__class__.__name__}"

        if default_storage.__class__.__module__.startswith("django.core.files.storage.filesystem"):
            self.stderr.write(
                "O storage ativo ainda e local. Ative o Supabase Storage antes de migrar."
            )
            return

        targets = [
            (
                Cliente.objects.filter(foto_perfil__isnull=False).exclude(foto_perfil=""),
                "foto_perfil",
                "clientes",
            ),
            (
                Bartender.objects.filter(foto_perfil__isnull=False).exclude(foto_perfil=""),
                "foto_perfil",
                "bartenders",
            ),
            (
                Drink.objects.filter(foto__isnull=False).exclude(foto=""),
                "foto",
                "drinks",
            ),
        ]

        migrated = 0
        migratable = 0
        skipped_existing = 0
        missing_local = 0
        failures = 0

        self.stdout.write(f"Storage destino: {storage_label}")

        for queryset, field_name, label in targets:
            for instance in queryset.iterator():
                field_file = getattr(instance, field_name)
                if not field_file:
                    continue

                storage_name = field_file.name
                local_path = media_root / storage_name

                if not local_path.exists():
                    missing_local += 1
                    self.stderr.write(
                        f"Arquivo local ausente para {label} #{instance.pk}: {storage_name}"
                    )
                    continue

                try:
                    remote_exists = default_storage.exists(storage_name)
                except Exception as exc:
                    failures += 1
                    self.stderr.write(
                        f"Falha ao verificar destino para {label} #{instance.pk}: {exc}"
                    )
                    continue

                if remote_exists and not overwrite:
                    skipped_existing += 1
                    continue

                if dry_run:
                    migratable += 1
                    continue

                try:
                    if remote_exists and overwrite:
                        default_storage.delete(storage_name)

                    with local_path.open("rb") as local_file:
                        saved_name = default_storage.save(storage_name, File(local_file))

                    if saved_name != storage_name:
                        self.stderr.write(
                            f"Destino alterou o nome de {storage_name} para {saved_name}."
                        )

                    migrated += 1
                except Exception as exc:
                    failures += 1
                    self.stderr.write(
                        f"Falha ao migrar {label} #{instance.pk}: {exc}"
                    )

        if dry_run:
            self.stdout.write(f"{migratable} arquivos seriam migrados.")
        else:
            self.stdout.write(self.style.SUCCESS(f"{migrated} arquivos migrados."))

        self.stdout.write(f"{skipped_existing} ja existiam no destino.")
        self.stdout.write(f"{missing_local} arquivos locais ausentes.")
        self.stdout.write(f"Falhas: {failures}.")
