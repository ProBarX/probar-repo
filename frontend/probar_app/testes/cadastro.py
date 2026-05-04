import os
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.chrome.options import Options

# Configurações para desabilitar o gerenciador de senhas do Chrome (para não ficar pop-up chato)
options = Options()

prefs = {
    "credentials_enable_service": False,
    "profile.password_manager_enabled": False,
    "profile.password_manager_leak_detection": False
}

options.add_experimental_option("prefs", prefs)

# Inicializa o navegador com as opções configuradas
navegador = webdriver.Chrome(options=options)
wait = WebDriverWait(navegador, 10)

# Acessa a página de login
navegador.get('http://localhost:3000/register')
navegador.maximize_window()

# Tipo de conta
wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "[data-testid='role-selector-cliente']"))).click()

# Campos com id
navegador.find_element(By.ID, "name").send_keys("Antônio Félix")
navegador.find_element(By.ID, "email").send_keys("antonio@teste.com")
navegador.find_element(By.ID, "password").send_keys("senha123")
navegador.find_element(By.ID, "confirmPassword").send_keys("senha123")

# Checkbox
navegador.find_element(By.ID, "terms").click()

# Submit
navegador.find_element(By.CSS_SELECTOR, "button[type='submit']").click()

# Espera o redirecionamento para a página de completar cadastro
wait.until(EC.url_contains("/client/complete"))

# Upload de foto - encontra o input escondido e envia o caminho da foto
foto = wait.until(EC.presence_of_element_located((By.ID, "input-foto")))
caminho_foto = os.path.abspath("c:\\Users\\anton\\Downloads\\foto para tudo.jpeg")
foto.send_keys(caminho_foto)

# Data de nascimento — digita direto, a máscara do formatarData cuida do formato
input_data = wait.until(EC.presence_of_element_located((By.ID, "data-nascimento")))
input_data.send_keys("01011990")

# Submit
navegador.find_element(By.ID, "btn-concluir").click()

# Verifica redirecionamento para /client/home
wait.until(EC.url_contains("/client/home"))

# Encontra o botão correspondente ao nome
nome = "luiz"
botao = wait.until(EC.element_to_be_clickable((
    By.XPATH,
    f"//p[contains(text(), '{nome}')]/following::button[1]"
)))

# rola a página para o botão ficar visível
navegador.execute_script("arguments[0].scrollIntoView({block: 'center'});", botao)

# destaca qual botão será clicado
navegador.execute_script("arguments[0].style.border='3px solid red'", botao)

# clique real
ActionChains(navegador).move_to_element(botao).pause(0.5).click().perform()

import time
time.sleep(10)
