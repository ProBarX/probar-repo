from io import BytesIO, StringIO

import pytest
from django.core.management import call_command
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from PIL import Image, ImageChops

from core.enums import TipoUsuario
from core.models import Drink, User
from core.services.image_processing import DRINK_IMAGE_SIZE, PROFILE_IMAGE_SIZE


def make_uploaded_image(name="photo.png", size=(500, 1200), color=(245, 197, 24)):
    buffer = BytesIO()
    Image.new("RGB", size, color).save(buffer, format="PNG")
    return SimpleUploadedFile(name, buffer.getvalue(), content_type="image/png")


def make_padded_drink_image():
    buffer = BytesIO()
    image = Image.new("RGB", DRINK_IMAGE_SIZE, (255, 255, 255))
    content = Image.new("RGB", (276, 184), (245, 197, 24))
    image.paste(content, (312, 208))
    image.save(buffer, format="JPEG")
    return buffer.getvalue()


def non_white_content_ratio(image):
    background = Image.new("RGB", image.size, (255, 255, 255))
    diff = ImageChops.difference(image.convert("RGB"), background).convert("L")
    bbox = diff.point(lambda value: 255 if value > 12 else 0).getbbox()
    if not bbox:
        return 0

    return ((bbox[2] - bbox[0]) * (bbox[3] - bbox[1])) / (image.width * image.height)


@pytest.mark.django_db
def test_bartender_profile_image_is_normalized(tmp_path):
    with override_settings(MEDIA_ROOT=tmp_path):
        user = User.objects.create_user(
            email="bartender-image@example.com",
            password="pass",
            tipo=TipoUsuario.BARTENDER,
        )

        bartender = user.bartender
        bartender.foto_perfil = make_uploaded_image(size=(500, 1200))
        bartender.save()

        with Image.open(bartender.foto_perfil.path) as image:
            assert image.size == PROFILE_IMAGE_SIZE
            assert image.format == "JPEG"

        assert bartender.foto_perfil.name.endswith(".jpg")


@pytest.mark.django_db
def test_drink_image_is_normalized_for_cards(tmp_path):
    with override_settings(MEDIA_ROOT=tmp_path):
        user = User.objects.create_user(
            email="drink-image@example.com",
            password="pass",
            tipo=TipoUsuario.BARTENDER,
        )
        bartender = user.bartender

        drink = Drink.objects.create(
            bartender=bartender,
            nome="Mojito",
            foto=make_uploaded_image(size=(300, 900)),
        )

        with Image.open(drink.foto.path) as image:
            assert image.size == DRINK_IMAGE_SIZE
            assert image.format == "JPEG"

        assert drink.foto.name.endswith(".jpg")


@pytest.mark.django_db
def test_normalizar_imagens_recovers_legacy_padded_drink_images(tmp_path):
    with override_settings(MEDIA_ROOT=tmp_path):
        user = User.objects.create_user(
            email="legacy-padded-drink@example.com",
            password="pass",
            tipo=TipoUsuario.BARTENDER,
        )
        bartender = user.bartender
        drink = Drink.objects.create(bartender=bartender, nome="Legacy drink")

        legacy_name = f"bartenders/{bartender.user_id}/drinks/legacy.jpg"
        legacy_path = tmp_path / legacy_name
        legacy_path.parent.mkdir(parents=True)
        legacy_path.write_bytes(make_padded_drink_image())
        drink.foto.name = legacy_name
        drink.save(update_fields=["foto"])

        call_command("normalizar_imagens")

        drink.refresh_from_db()
        with Image.open(drink.foto.path) as image:
            assert image.size == DRINK_IMAGE_SIZE
            assert image.format == "JPEG"
            assert non_white_content_ratio(image) > 0.95


@pytest.mark.django_db
def test_normalizar_imagens_reports_normalized_and_missing_files(tmp_path):
    with override_settings(MEDIA_ROOT=tmp_path):
        normalized_user = User.objects.create_user(
            email="normalized-image@example.com",
            password="pass",
            tipo=TipoUsuario.BARTENDER,
        )
        normalized = normalized_user.bartender
        normalized.foto_perfil = make_uploaded_image(size=(500, 1200))
        normalized.save()

        missing_user = User.objects.create_user(
            email="missing-image@example.com",
            password="pass",
            tipo=TipoUsuario.BARTENDER,
        )
        missing = missing_user.bartender
        missing.foto_perfil.name = "bartenders/999/foto_perfil/missing.png"
        missing.save(update_fields=["foto_perfil"])

        stdout = StringIO()
        call_command("normalizar_imagens", "--dry-run", stdout=stdout)

    output = stdout.getvalue()
    assert "0 imagens seriam normalizadas." in output
    assert "1 imagens ja estao normalizadas." in output
    assert "1 referencias apontam para arquivos ausentes." in output
