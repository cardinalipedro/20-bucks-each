# 20 Bucks Each

Leilão de jogadores da NBA: cada técnico tem $20 pra montar o quinteto mais forte.

**Versão atual:** salas multiplayer (públicas e privadas) ou treino contra bots, leilão ao vivo e campeonato simulado (temporada regular, playoffs e prêmios).

## Como rodar

Precisa do Node.js 20.9 ou mais novo.

```bash
npm install
npm run dev
```

O `npm run dev` sobe **duas coisas juntas**: o site (http://localhost:3000) e o servidor das salas (porta 3001).
Pra testar o multiplayer no seu PC, abra o site em duas janelas diferentes (uma normal e uma anônima), crie a sala numa e entre pela outra.

Se quiser rodar separado: `npm run dev:web` (só o site) e `npm run dev:server` (só o servidor).

Outros comandos:

| Comando | O que faz |
| --- | --- |
| `npm test` | Roda os testes do motor do leilão |
| `npm run typecheck` | Checa os tipos do TypeScript |
| `npm run build` | Gera a versão de produção do site |
| `npm run start:server` | Roda o servidor das salas em produção |

## Estrutura

```
server/index.ts        Servidor das salas (Socket.IO): só repassa mensagens
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
  lib/rooms/           Salas (TypeScript puro, testado)
    service.ts         Criar/entrar/sair, configurações, início, modo ausente, bots substitutos
    validate.ts        Confere tudo que chega do navegador antes de usar
    events.ts          Nomes dos eventos entre site e servidor
  components/tournament/  Telas da temporada, chave dos playoffs e prêmios
  components/room/     Sala de espera, configurações da sala, aviso de ausente
  app/sala/[code]/     Página de uma sala (/sala/K7Q2M)
```

## Salas e modo ausente

- **Pública:** aparece na lista da tela inicial. **Privada:** só entra quem tem o link ou o código.
- O dono da sala pode mudar visibilidade, limite de técnicos e regras antes de começar (botão Configurações). Mudar as regras tira o "pronto" de todo mundo. Se o dono sair, outro jogador vira dono.
- Todo mundo precisa clicar em **Estou pronto** antes do dono conseguir começar.
- O dono pode **expulsar** alguém da sala de espera; quem foi expulso não consegue voltar naquela sala.
- Vagas vazias viram bots na hora de começar (se a opção estiver ligada).
- **Ausente:** 45s sem mexer (mouse, toque ou teclado), ou cair a conexão, e um bot assume (`AWAY_AFTER_MS` em `lib/rooms/service.ts`). Qualquer movimento ou o botão "Voltar a jogar" devolve o controle.
  - Na sala de espera, o bot marca você como pronto. Se o **dono** estiver ausente e todos os outros prontos, o bot dele começa a partida.
  - No leilão, o bot dá lances por você.
  - Na tática, o bot escolhe a que mais combina com o seu elenco.
- Quem **sai** da partida é substituído por um bot de vez.
- Recarregar a página não tira você da sala: o navegador guarda um token secreto que devolve sua vaga.

## Tática

Depois do leilão cada técnico escolhe **estilo de ataque** (Equilibrado, Chuva de 3, Garrafão) e **ritmo** (Lento, Normal, Rápido). Nas salas são 60s (`TACTICS_MS`); se o tempo acabar, vale o que estiver marcado.

- Cada estilo olha um ponto do elenco (média dos titulares): Chuva de 3 → arremesso; Garrafão → finalização + rebote; Rápido → atletismo; Lento → armação. Equilibrado e Normal não mudam nada.
- Acima da média da liga, o estilo soma força; abaixo, tira. Cada parte vai de −3 a +3, e o total fica entre −4 e +4 (`lib/sim/tactics.ts`).
- O ritmo também muda o placar: jogos rápidos têm mais pontos, lentos têm menos.
- A tela mostra o encaixe de cada opção (de "Encaixe perfeito" até "Não combina") e a força final do time. As táticas dos outros ficam secretas até os jogos.
- Os bots sempre escolhem a tática que mais combina com o elenco deles.

## Publicar online

O site e o servidor das salas rodam em lugares diferentes:

1. **Servidor das salas:** qualquer hospedagem que rode Node.js o tempo todo (Render, Railway, Fly.io…). Comando de instalação `npm install`, comando de início `npm run start:server`, e a variável `CLIENT_ORIGIN` com o endereço do site (ex.: `https://20-bucks-each.vercel.app`).
2. **Site na Vercel:** adicione a variável `NEXT_PUBLIC_SERVER_URL` com o endereço do servidor (ex.: `https://20-bucks-each-server.onrender.com`).

Sem o servidor, o site continua funcionando no modo treino contra bots.

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
4. ~~Multiplayer em tempo real (salas com link de convite)~~ ✅
5. Base de jogadores real e polimento visual
