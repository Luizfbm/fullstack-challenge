import {
  Activity,
  Gauge,
  History,
  Radar,
  ShieldCheck,
  WalletCards,
  type LucideIcon,
} from "lucide-react";

export type RailItemId =
  | "cockpit"
  | "wallet"
  | "api"
  | "flows"
  | "observe"
  | "audit";

export type UtilityLink = {
  credential?: string;
  description: string;
  href: string;
  label: string;
};

export type UtilityCredential = {
  label: string;
  password: string;
  username: string;
};

export type RailItem = {
  credentials?: UtilityCredential[];
  copyValue?: string;
  description: string;
  icon: LucideIcon;
  id: RailItemId;
  links: UtilityLink[];
  title: string;
};

export const railItems: RailItem[] = [
  {
    copyValue:
      "Repo: https://github.com/Luizfbm/fullstack-challenge/tree/crash-game-implementation\nApp: http://localhost:8000/\nRun: bun run docker:up",
    description: "Entrada rapida para revisar entrega, README e app pelo Kong.",
    icon: Gauge,
    id: "cockpit",
    links: [
      {
        description: "Branch de entrega publicada para avaliacao.",
        href: "https://github.com/Luizfbm/fullstack-challenge/tree/crash-game-implementation",
        label: "Repositorio GitHub",
      },
      {
        description: "Instrucoes, arquitetura, trade-offs e comandos.",
        href: "https://github.com/Luizfbm/fullstack-challenge/blob/crash-game-implementation/README.md",
        label: "README da entrega",
      },
      {
        description: "Experiencia principal via API Gateway.",
        href: "http://localhost:8000/",
        label: "Aplicacao local",
      },
    ],
    title: "Entrega",
  },
  {
    copyValue:
      "Player: player / player123\nKeycloak admin: admin / admin\nRabbitMQ: admin / admin\nGrafana: admin / admin",
    credentials: [
      { label: "Jogador Keycloak", username: "player", password: "player123" },
      { label: "Keycloak admin", username: "admin", password: "admin" },
      { label: "RabbitMQ", username: "admin", password: "admin" },
      { label: "Grafana", username: "admin", password: "admin" },
    ],
    description:
      "Credenciais locais para entrar no jogo e nos dashboards da stack.",
    icon: WalletCards,
    id: "wallet",
    links: [
      {
        credential: "player / player123",
        description: "Login do jogador, com wallet inicial de R$ 1.000,00.",
        href: "http://localhost:8000/",
        label: "Entrar como jogador",
      },
      {
        credential: "admin / admin",
        description: "Fila de comandos financeiros wallet.commands.",
        href: "http://localhost:15672",
        label: "RabbitMQ Management",
      },
      {
        description: "Contrato REST da Wallet.",
        href: "http://localhost:4002/docs",
        label: "Wallet Swagger",
      },
    ],
    title: "Acessos",
  },
  {
    copyValue:
      "Game Swagger: http://localhost:4001/docs\nGame metrics: http://localhost:8000/games/metrics\nWallet metrics: http://localhost:8000/wallets/metrics",
    description:
      "Atalhos para APIs, metricas Prometheus e endpoints publicos via Kong.",
    icon: Activity,
    id: "api",
    links: [
      {
        description: "Contrato REST do Game Service.",
        href: "http://localhost:4001/docs",
        label: "Game Swagger",
      },
      {
        description: "Contrato REST da Wallet.",
        href: "http://localhost:4002/docs",
        label: "Wallet Swagger",
      },
      {
        description: "Metricas Prometheus do Game via Kong.",
        href: "http://localhost:8000/games/metrics",
        label: "Game metrics",
      },
      {
        description: "Metricas Prometheus da Wallet via Kong.",
        href: "http://localhost:8000/wallets/metrics",
        label: "Wallet metrics",
      },
    ],
    title: "APIs",
  },
  {
    copyValue:
      "ci:local: bun run ci:local\nci:e2e: bun run ci:e2e\nbrowser: bun run test:e2e:browser",
    description: "Comandos e evidencias dos fluxos obrigatorios do desafio.",
    icon: History,
    id: "flows",
    links: [
      {
        description: "Fluxo browser: login, aposta, cashout, auto cashout.",
        href: "https://github.com/Luizfbm/fullstack-challenge/blob/crash-game-implementation/tests/browser/player-flow.spec.ts",
        label: "Playwright player flow",
      },
      {
        description: "E2E de cashout, wallet, liquidacao e provably fair.",
        href: "https://github.com/Luizfbm/fullstack-challenge/blob/crash-game-implementation/services/games/tests/e2e/cashout-flow.e2e.test.ts",
        label: "Cashout E2E",
      },
      {
        description: "E2E de crash, perda da aposta e verificacao da rodada.",
        href: "https://github.com/Luizfbm/fullstack-challenge/blob/crash-game-implementation/services/games/tests/e2e/crash-loss-flow.e2e.test.ts",
        label: "Crash loss E2E",
      },
    ],
    title: "Fluxos",
  },
  {
    copyValue:
      "Grafana: http://localhost:3001 admin/admin\nPrometheus: http://localhost:9090\nJaeger: http://localhost:16686\nRabbitMQ: http://localhost:15672 admin/admin",
    description: "Observabilidade local: dashboard, metricas, tracing e fila.",
    icon: Radar,
    id: "observe",
    links: [
      {
        credential: "admin / admin",
        description: "Dashboard Crash Game Observability.",
        href: "http://localhost:3001",
        label: "Grafana",
      },
      {
        description: "Consultas Prometheus sem login local.",
        href: "http://localhost:9090",
        label: "Prometheus",
      },
      {
        description: "Traces OpenTelemetry exportados pela stack.",
        href: "http://localhost:16686",
        label: "Jaeger",
      },
      {
        credential: "admin / admin",
        description: "Inspecao de exchanges, filas e mensagens.",
        href: "http://localhost:15672",
        label: "RabbitMQ",
      },
      {
        description: "Admin local DB-less do API Gateway.",
        href: "http://localhost:8001",
        label: "Kong Admin",
      },
    ],
    title: "Observabilidade",
  },
  {
    copyValue:
      "Keycloak admin: http://localhost:8080/admin/master/console/ admin/admin\nRealm: crash-game\nClient ID: crash-game-client\nPlayer: player/player123",
    credentials: [
      { label: "Keycloak admin", username: "admin", password: "admin" },
      { label: "Jogador Keycloak", username: "player", password: "player123" },
    ],
    description:
      "Seguranca, IdP, JWT, provably fair e consistencia financeira.",
    icon: ShieldCheck,
    id: "audit",
    links: [
      {
        credential: "admin / admin",
        description: "Realm crash-game, client public PKCE e usuario player.",
        href: "http://localhost:8080/admin/master/console/",
        label: "Keycloak admin",
      },
      {
        description: "Dados de verificacao provably fair da rodada atual.",
        href: "http://localhost:8000/games/rounds/current",
        label: "Round atual",
      },
      {
        description: "Design dos requisitos eliminatorios no README.",
        href: "https://github.com/Luizfbm/fullstack-challenge/blob/crash-game-implementation/README.md#requisitos-eliminatorios-do-desafio",
        label: "Checklist no README",
      },
    ],
    title: "Auditoria",
  },
];
