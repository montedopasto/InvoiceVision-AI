# InvoiceVision AI 2.6 — configuração

## 1. Preparar a Google Sheet

1. Abra a Google Sheet que será usada pela aplicação.
2. Abra **Extensões → Apps Script**.
3. Substitua o conteúdo do projeto pelo ficheiro `Code.gs` deste pacote.
4. Em **Definições do projeto**, selecione o fuso horário `Europe/Lisbon`.
5. Execute `configurarInvoiceVision` uma vez e aceite as autorizações.

Se já existir uma folha `PENDENTES` da versão anterior, a função converte-a
automaticamente. Antes da conversão cria uma cópia chamada
`PENDENTES_BACKUP_aaaammdd_hhmmss`; não é necessário apagar dados existentes.

São criadas estas folhas:

- `CONFIGURACAO`: parâmetros gerais e definição segura de palavras-passe.
- `ADMIN_INICIAL`: criação controlada do primeiro administrador.
- `UTILIZADORES`: contas, perfil e vendedor associado.
- `SESSOES`: sessões autenticadas e respetiva validade.
- `CLIENTES_VENDEDORES`: associação entre clientes e vendedores.
- `PENDENTES`: faturas da importação atual.
- `NOTAS_FATURAS`: status/notas persistentes por fatura.
- `HISTORICO_IMPORTACOES`: resumo de cada importação.

Não altere os nomes nem a ordem das colunas criadas automaticamente.

## 2. Criar o primeiro administrador

1. Na folha `ADMIN_INICIAL`, preencha a segunda linha:

| NOME | UTILIZADOR | PASSWORD | EMAIL |
|---|---|---|---|
| O seu nome | O seu login | A sua password | O seu email |

2. No Apps Script, execute `criarAdministradorInicial`.
3. A password é convertida em hash e apagada imediatamente da folha.
4. Entre na aplicação com o utilizador e a password que definiu.

Esta função só funciona enquanto não existir nenhum utilizador. Não existe criação pública de administradores no ecrã de login.

## 3. Criar utilizadores

Depois de entrar como administrador:

1. Abra o menu **Utilizadores**.
2. Preencha apenas:
   - Nome
   - Utilizador
   - Password
   - Email
   - Perfil
   - Código do vendedor, quando o perfil for Vendedor
3. Clique em **Criar utilizador**.

A aplicação cria automaticamente o salt e o hash de segurança. A password original nunca fica guardada na Sheet.

O administrador também pode apagar utilizadores no mesmo ecrã. A aplicação impede que apague a conta com que tem a sessão iniciada.

## 4. Associar clientes aos vendedores

Na folha `CLIENTES_VENDEDORES`, crie uma linha por cliente:

| Coluna | Valor |
|---|---|
| `NUMERO_CLIENTE` | Deve coincidir exatamente com `N.` do CSV |
| `NOME_CLIENTE` | Nome informativo do cliente |
| `VENDEDOR_ID` | Deve coincidir com `VENDEDOR_ID` em `UTILIZADORES` |
| `ATIVO` | `SIM` ou `NAO` |

Um vendedor só recebe e vê faturas de clientes associados ao seu `VENDEDOR_ID`.
Clientes e faturas classificados como `CONTENCIOSO` são excluídos no servidor da área pessoal e de todos os emails.

## 5. Publicar a API

1. No Apps Script, selecione **Implementar → Nova implementação**.
2. Tipo: **Aplicação Web**.
3. Executar como: **Eu** (proprietário da Sheet).
4. Quem tem acesso: **Qualquer pessoa**.
5. Implemente e copie o URL terminado em `/exec`.
6. Em `app-v2-5.js`, substitua o valor de `API_URL` pelo novo URL.

Embora a implementação aceite pedidos públicos, os dados e alterações exigem uma sessão InvoiceVision válida. A autenticação não depende de Gmail ou da conta Google do vendedor.

Sempre que alterar `Code.gs`, crie uma nova versão da implementação da Aplicação Web.

## 6. Triggers e emails

`configurarInvoiceVision` chama automaticamente `instalarTriggers`, que cria:

- `enviarResumoSemanalVendedores`: semanal, segunda-feira às 08:00 por defeito.
- `enviarAvisosDiariosSemNota`: diariamente às 09:00 por defeito.
- `limparSessoesExpiradas`: diariamente.
- `importarPendentesDoDrive`: diariamente, às 06:00 por defeito.

Pode alterar antes da instalação:

- `RESUMO_SEMANAL_DIA`: `MONDAY`, `TUESDAY`, `WEDNESDAY`, `THURSDAY` ou `FRIDAY`.
- `RESUMO_SEMANAL_HORA`: hora entre 0 e 23.
- `AVISO_DIARIO_HORA`: hora entre 0 e 23.

Depois de mudar estes valores, execute `instalarTriggers`.

O resumo semanal inclui a situação dos clientes do vendedor e destaca dívidas vencidas. O aviso diário inclui apenas documentos vencidos que não tenham nem status nem nota, repetindo-se até um desses campos ser preenchido.

## 7. Importação automática do Excel recebido por email

1. No Google Drive, crie uma pasta chamada `InvoiceVision - Pendentes`.
2. Abra a pasta e copie da barra de endereço apenas o ID que aparece depois de `/folders/`.
3. Na folha `CONFIGURACAO`, coloque esse ID no valor de `PASTA_DRIVE_PENDENTES_ID`.
4. Se quiser outra hora, altere `IMPORTACAO_AUTOMATICA_HORA` (0 a 23).
5. No Apps Script, em **Serviços**, adicione **Google Drive API**. Se utilizar também o ficheiro `appsscript.json` fornecido, o serviço já fica declarado no projeto.
6. Execute `instalarTriggers` novamente e aceite as permissões do Google Drive.
7. Para testar imediatamente, coloque `Pendentes.xlsx` na pasta e execute `importarPendentesDoDrive`.

A rotina aceita diretamente `.xlsx` e `.xls`, lê a folha `PENDENTES`, importa todos os ficheiros por ordem de data e, após sucesso, move-os para a subpasta `Processados`. As notas e associações existentes são preservadas. Se houver erro, os administradores recebem um email e o ficheiro fica na pasta para nova tentativa.

## 8. Status disponíveis

- `CONTACTAR`
- `CONTACTADO`
- `PROMESSA_PAGAMENTO`
- `EM_ANALISE`
- `CONTESTADA`
- `PAGO_AGUARDA_BAIXA`

As notas ficam na folha `NOTAS_FATURAS`, ligadas ao `ID_FATURA`. Como o identificador é recriado a partir do cliente, tipo/número do documento e vencimento, as notas sobrevivem às importações seguintes enquanto esses dados não forem alterados.

## 9. Teste recomendado

1. Entre como administrador e faça uma importação.
2. Confirme que `PENDENTES` contém as faturas.
3. Entre como vendedor e confirme que só aparece **Os Meus Clientes**.
4. Confirme que nenhum documento em `CONTENCIOSO` aparece.
5. Guarde status e nota numa fatura, atualize a página e confirme a persistência.
6. Para testar sem esperar pelos triggers, execute manualmente:
   - `enviarResumoSemanalVendedores`
   - `enviarAvisosDiariosSemNota`
