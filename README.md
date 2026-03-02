# Dashboard de Finanças

Dashboard de finanças pessoais construído com React, Vite e Tailwind CSS.

## Tecnologias

- [React 19](https://react.dev/) — biblioteca para interfaces de usuário
- [Vite 7](https://vite.dev/) — build tool rápido para desenvolvimento moderno
- [Tailwind CSS 4](https://tailwindcss.com/) — framework CSS utility-first

## Pré-requisitos

- [Node.js](https://nodejs.org/) >= 18
- npm >= 9

## Instalação

```bash
# Clone o repositório
git clone git@github.com:juarezjunior95/dashboard-finances.git
cd dashboard-finances

# Instale as dependências
npm install
```

## Scripts disponíveis

| Comando           | Descrição                                      |
| ----------------- | ---------------------------------------------- |
| `npm run dev`     | Inicia o servidor de desenvolvimento (HMR)     |
| `npm run build`   | Gera o build de produção em `dist/`            |
| `npm run preview` | Pré-visualiza o build de produção localmente   |
| `npm run lint`    | Executa o ESLint para verificar o código        |

## Estrutura do projeto

```
├── index.html          # Ponto de entrada HTML
├── vite.config.js      # Configuração do Vite + plugins
├── package.json        # Dependências e scripts
├── public/             # Arquivos estáticos
│   └── vite.svg
└── src/
    ├── main.jsx        # Ponto de entrada React
    ├── App.jsx         # Componente principal
    ├── index.css       # Estilos globais (Tailwind)
    └── assets/         # Assets importados pelo bundler
```

## Desenvolvimento

```bash
npm run dev
```

O servidor de desenvolvimento será iniciado em `http://localhost:5173` com Hot Module Replacement (HMR) habilitado.

## Build de produção

```bash
npm run build
npm run preview
```

O build otimizado será gerado na pasta `dist/`.
