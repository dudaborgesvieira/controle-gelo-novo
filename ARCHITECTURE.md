# Documento de Arquitetura - Controle de Gelo

Este documento descreve a arquitetura limpa (Clean Architecture) e as decisões de design para o projeto **Controle de Gelo**, um sistema profissional projetado para operar em postos de combustíveis de forma confiável, segura e altamente escalável.

---

## 1. Visão Geral da Arquitetura

Para garantir manutenibilidade, separação de conceitos e facilidade de expansão futura (adicionando módulos como água desmineralizada, lubrificantes, etc.), implementamos uma **Clean Architecture (Arquitetura Limpa)** adaptada para aplicações modernas.

A estrutura é dividida em quatro camadas principais independentes:

```
┌──────────────────────────────────────────────────────────┐
│                      Camada de UI                        │
│   (Componentes React, Telas Responsive, Hooks de View)   │
└────────────┬─────────────────────────────────────────────┘
             │ (Chama Controllers/Use Cases)
┌────────────▼─────────────────────────────────────────────┐
│                   Camada de Apresentação                 │
│         (Estado Global, Controllers de Fluxo,            │
│            Gerenciadores de Contexto de UI)              │
└────────────┬─────────────────────────────────────────────┘
             │ (Opera sobre entidades)
┌────────────▼─────────────────────────────────────────────┐
│                     Camada de Domínio                    │
│      (Regras de Negócio Puras, Modelos, Validadores)     │
└────────────┬─────────────────────────────────────────────┘
             │ (Através de Interfaces/Contratos)
┌────────────▼─────────────────────────────────────────────┐
│                  Camada de Infraestrutura                │
│    (Repositórios, Cache Local/IndexedDB, Firebase Sync)  │
└──────────────────────────────────────────────────────────┘
```

---

## 2. Estrutura de Diretórios do Projeto

Para refletir a Clean Architecture de forma pragmática e modular no Next.js (com suporte completo a TypeScript), utilizaremos a seguinte estrutura dentro do diretório do projeto:

```
/
├── app/                        # Next.js App Router (Páginas e Rotas de API)
│   ├── globals.css             # Estilos Globais (Tailwind v4)
│   ├── layout.tsx              # Layout Raiz e Configuração de Fontes (Inter)
│   ├── page.tsx                # Tela Principal (Direciona para Login/Dashboard)
│   └── api/                    # Rotas de Servidor para Proxy/Regras de Backend
│
├── components/                 # Componentes de UI Reutilizáveis (Visualmente Polidos)
│   ├── ui/                     # Elementos Base (Botões, Inputs, Cards, etc.)
│   ├── shared/                 # Componentes compartilhados de layout (TopBar, BottomNav)
│   └── screens/                # Representações fiéis dos protótipos visuais
│       ├── access/             # Acesso Restrito (Senha Numérica - Tela 1)
│       ├── sales/              # Registrar Venda (Tela 2)
│       ├── losses/             # Registrar Perda (Tela 3)
│       └── dashboard/          # Painel Administrativo / Histórico (Tela 4)
│
├── core/                       # Núcleo da Aplicação (Camada de Domínio e Casos de Uso)
│   ├── entities/               # Modelos de Dados Puros (Movimentação, Frentista, Config)
│   │   ├── movement.ts
│   │   ├── attendant.ts
│   │   └── settings.ts
│   └── usecases/               # Lógica de Negócio pura
│       ├── calculateStock.ts   # Fórmula: Estoque = Inicial + Prod - Vendas - Cortesias - Perdas
│       ├── applyDiscount.ts    # Lógica de cálculos e percentuais de desconto
│       └── validateMovement.ts # Impede estoque negativo, valida preenchimento
│
├── services/                   # Camada de Serviços e Infraestrutura (Contratos e Provedores)
│   ├── persistence/            # Repositórios de Dados
│   │   ├── StorageInterface.ts # Contrato (Interface) de persistência
│   │   ├── LocalStorageImpl.ts # Implementação Offline-First (LocalStorage/IndexedDB)
│   │   └── FirebaseStorageImpl.ts # Implementação Firebase (Pronta para ativação)
│   ├── sync/                   # Serviço de Sincronização em Segundo Plano
│   │   └── SyncEngine.ts       # Detecta status de conexão e sincroniza logs pendentes
│   └── export/                 # Exportador de Relatórios
│       ├── pdfExporter.ts
│       └── excelExporter.ts
│
├── hooks/                      # Custom Hooks do React para Gerenciamento de Estado
│   ├── useIceApp.ts            # Hook unificado que conecta UI aos UseCases e Serviços
│   └── useMobile.ts            # Utilitário de responsividade
│
└── lib/                        # Utilitários gerais
    └── utils.ts                # Concatenação de classes CSS (cn) e formatação (BRL)
```

---

## 3. Fluxo de Dados e Decisões de Arquitetura

### A. Estratégia de Sincronização (Offline-First)
Para garantir que nenhum registro seja perdido, a aplicação adota uma estratégia de **Fila de Escrita Local (Local Write Queue)**:
1. Toda operação de movimentação (Venda, Produção, Cortesia, Perda) é persistida imediatamente no banco de dados local da aplicação (`LocalStorage` ou `IndexedDB`) e adicionada a uma fila de sincronização pendente.
2. O `SyncEngine` escuta os eventos de conexão (`online`/`offline`) do navegador.
3. Quando a internet está disponível, os registros pendentes são enviados em lote para o Firebase Cloud Firestore em segundo plano, esvaziando a fila de forma transparente para o usuário.

### B. Fórmula do Estoque Automatizado
Para mitigar inconsistências, o estoque nunca é armazenado de forma estática e mutável sem histórico. O valor do Estoque Atual é um estado calculado e auditável:
$$\text{Estoque Atual} = \text{Estoque Inicial} + \sum \text{Produção} - \sum \text{Vendas} - \sum \text{Cortesias} - \sum \text{Perdas}$$
- Se uma movimentação resultar em estoque negativo, a camada de Casos de Uso (`validateMovement.ts`) bloqueia a operação imediatamente no dispositivo e exibe um alerta explicativo ao frentista.

### C. Segurança e Controle de Perfis
*   **Frentista**: Opera em modo restrito, acessando formulários rápidos de venda, cortesia, perda e produção. Consegue consultar suas próprias movimentações recentes em um painel simplificado.
*   **Administrador**: Possui acesso exclusivo através do painel de Senha Numérica (Tela 1). Pode visualizar todos os logs, alterar configurações críticas (como o preço padrão do saco de gelo de R$ 10,00 e o estoque inicial), cadastrar e desativar frentistas, e gerar exportações.

---

## 4. Análise de Inconsistências e Proposta de Melhorias no Protótipo

Analisando minuciosamente as telas do protótipo e as regras de negócio descritas, identificamos os seguintes pontos de melhoria que serão implementados mantendo a integridade visual:

1.  **Forma de Pagamento "Dinheiro"**: A imagem do protótipo de *Registrar Venda* inclui o botão "Dinheiro", mas o texto original não o listava. **Decisão**: Incluiremos o método de pagamento "Dinheiro" para garantir 100% de conformidade com a interface proposta.
2.  **Autorização de Descontos**: O fluxo de descontos permite alterar o valor unitário ou conceder um desconto total. Para preparar o sistema para a futura exigência de autorização do administrador, incluiremos uma configuração nas propriedades administrativas: `Exigir senha de administrador para aplicar desconto`. Se ativo, um pop-up com o teclado numérico (idêntico à Tela 1) solicitará a senha do admin antes de aprovar o desconto.
3.  **Seleção do Frentista Ativo**: Para que as vendas e perdas fiquem registradas no nome do frentista correto, adicionaremos uma seleção rápida de operador na tela inicial, além de permitir alternar o usuário de forma simples.
4.  **Feedback Visual de Sincronização**: Adicionaremos um pequeno indicador visual de status de sincronização (ex: "Nuvem verde" para sincronizado, "Nuvem laranja com contador" para itens pendentes offline) na barra superior, oferecendo total tranquilidade operacional ao usuário do posto.

---

## 5. Preparação para Expansão Futura (Escalabilidade)

Para garantir que a arquitetura não precise ser reescrita para novos módulos (água, lubrificantes, etc.):
*   As entidades de movimentação utilizam uma tipagem base expansível. Um produto tem um `productId` (atualmente default `gelo`). Para novos produtos, basta passar o ID correspondente.
*   O estoque é calculado por produto. Os métodos aceitam `productId` como parâmetro opcional, facilitando a portabilidade para um estoque geral de múltiplos itens de forma imediata.
