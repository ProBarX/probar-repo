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
navegador.get('http://localhost:3000/login')
navegador.maximize_window()

# Preenche os campos de email e senha
navegador.find_element(By.ID, 'email').send_keys('teste@gmail.com')
navegador.find_element(By.ID, 'password').send_keys('123321')

wait.until(EC.element_to_be_clickable((By.ID, "login-btn"))).click()

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

# só para não fechar a janela imediatamente
import time
time.sleep(10)