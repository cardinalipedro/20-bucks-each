# 20 Bucks Each

Leilão de jogadores da NBA: cada técnico tem $20 pra montar o quinteto mais forte.

**Versão atual:** leilão local contra bots + campeonato simulado (temporada regular, playoffs e prêmios).

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
  lib/sim/             Simulação do campeonato (TypeScript puro)
    probability.ts     Chance de vitória: 65% força + 35% sorte (SKILL_WEIGHT)
    strength.ts        Força do time (titulares, fora de posição, banco)
    game.ts            Um jogo: placar, quartos e estatísticas dos jogadores
    tournament.ts      Tabela, temporada, playoffs (séries com chaveamento) e MVP
    sim.test.ts        Testes
  components/tournament/  Telas da temporada, chave dos playoffs e prêmios
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

## Como a simulação funciona

- **Força do time:** média dos titulares, −3 por jogador fora de posição, mais um bônus pequeno pelo banco.
- **Chance de vitória:** `65% × curva da diferença de força + 35% × 50%`. Times iguais = 50%; 90 × 85 ≈ 72%; o azarão sempre tem pelo menos ~17%.
- **Placar:** a margem de pontos é sorteada de uma curva normal ajustada para bater com essa chance; os pontos são divididos em quartos (com prorrogação se empatar) e entre os jogadores pelos atributos.
- **Temporada:** todos contra todos (ida e volta até 6 times). Desempate: vitórias, saldo, pontos feitos.
- **Playoffs:** chave padrão (1×8, 4×5…), folga para os melhores quando o número não fecha, séries de 1, 3 ou 7 jogos (mando 2-2-1-1-1).
- **MVP:** maior média de pontos + 1,2 × rebotes + 1,5 × assistências na temporada.

## Próximas etapas

2. Ajustes do leilão a partir dos seus testes
3. ~~Simulação: temporada regular + playoffs~~ ✅
4. Multiplayer em tempo real (salas com link de convite)
5. Base de jogadores real e polimento visual
