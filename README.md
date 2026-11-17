# 20 Bucks Each

Leilão de jogadores da NBA: cada técnico tem $20 pra montar o quinteto mais forte.

**Etapa 1 (esta versão):** leilão local, você contra bots, com tela de resultado.

## Como rodar

Precisa do Node.js 20.9 ou mais novo.

```bash
npm install
npm run dev
```

Abra http://localhost:3000.

Outros comandos:

| Comando | O que faz |
| --- | --- |
| `npm test` | Roda os testes do motor do leilão |
| `npm run typecheck` | Checa os tipos do TypeScript |
| `npm run build` | Gera a versão de produção |

## Estrutura

```
src/
  app/                 Rotas do Next.js (layout, página inicial, CSS global)
  components/          Telas: SetupScreen, AuctionScreen, ResultsScreen, mascote
  hooks/useAuction.ts  Liga o motor ao React (relógio, lances, passar)
  i18n/                Traduções PT/EN/ES (messages.ts) e o provider do idioma
  theme/               Tema claro/escuro (variáveis em app/globals.css)
  data/players.ts      Base de jogadores (PROVISÓRIA: ratings estimados)
  lib/auction/         Motor do leilão em TypeScript puro, sem React
    types.ts           Tipos (Player, Coach, Lot, AuctionState…)
    rules.ts           Regras: lance máximo, vagas por posição, força do time
    bots.ts            Como os bots avaliam e dão lance
    pool.ts            Sorteio do pool limitado de jogadores do leilão
    engine.ts          createAuction, placeBid, passLot, tick
    engine.test.ts     Testes
```

O motor (`lib/auction`) é puro: recebe um estado e devolve um estado novo, sem mexer em nada fora.
Por isso dá pra testar sem abrir o navegador, e na etapa do multiplayer o mesmo código vai rodar no servidor.

## Regras implementadas

- Todo mundo começa com $20 e precisa fechar PG, SG, SF, PF e C (+2 reservas, se ativado).
- Cada leilão sorteia um pool limitado: vagas de todos + 30% (`POOL_FACTOR` em `lib/auction/pool.ts`), com cada posição garantida.
- Os jogadores vão a leilão um por um, em ordem aleatória, sem mostrar quem vem depois.
- Cada jogador tem um relógio (10, 15 ou 20s) que **não reinicia** com lances. Um lance nos últimos 3s volta o relógio para 3s (`BID_EXTENSION_SECONDS` em `lib/auction/rules.ts`). Quando zera, o maior lance leva.
- Lance máximo = saldo − $1 por vaga que ainda falta (ninguém fica sem dinheiro pra completar o time).
- O jogador só pode ser comprado por quem tem vaga na posição dele (posição principal ou secundária) ou no banco.
- Se todo mundo passar, o lote fecha na hora.
- Se no fim sobrar vaga aberta, ela é preenchida de graça com o **pior** jogador que sobrou (passar esperando craque é arriscado).

## Próximas etapas

2. Ajustes do leilão a partir dos seus testes
3. Simulação: temporada regular + playoffs
4. Multiplayer em tempo real (salas com link de convite)
5. Base de jogadores real e polimento visual
