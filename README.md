# Cartas e Monstros

Primeira região jogável de um RPG de captura elemental para navegador, desktop e celular. O mapa é gerado por semente em 96 × 96 tiles, com níveis de altura de 0 a 4, pontes, rampas, três biomas de encontros, casas, santuários e monstros visíveis. A biblioteca visual tem 80 tiles e 48 novos objetos independentes, distribuídos em áreas de concentração com corredores livres. O vilarejo inclui padaria, moradias, poço, bancos, floreiras, postes iluminados e quatro moradores ambulantes. A arte do jogo está em arquivos PNG próprios sobre geometria 2,5D.

## Executar

Requer Node.js 20.19+ ou 22.12+.

```sh
npm install
npm run dev
```

Abra o endereço informado pelo Vite. Para testar a versão instalável e o cache offline:

```sh
npm run build
npm run preview
```

O aplicativo funciona offline depois de abrir a versão de produção uma vez com conexão. O progresso fica no armazenamento local do navegador.

### Instalar como aplicativo (PWA)

A versão de produção inclui manifesto, ícones para Android/iOS, orientação horizontal e service worker com os arquivos do jogo. Abra o jogo por **HTTPS** no celular. Na tela inicial ou na pausa, toque em **Instalar jogo** quando o navegador oferecer a instalação. Se o convite automático não aparecer, use **Como instalar**: no Android, procure **Instalar app** no menu do navegador; no iPhone/iPad, use **Compartilhar → Adicionar à Tela de Início** no Safari. Depois, abra o jogo pelo ícone criado.

O endereço `http://127.0.0.1` permite testar a instalação no próprio computador. A prévia `npm run lan` usa HTTP no IP do Wi-Fi e serve para jogar no celular, mas não para instalar o PWA ou testar o cache offline nele. Para instalar no aparelho, publique o conteúdo de `dist/` em uma origem HTTPS ou use um servidor HTTPS cujo certificado seja confiável para o aparelho. O progresso salvo pertence à origem usada; mudar de endereço cria outro armazenamento local.

### Teste no celular pelo Wi-Fi

```sh
npm run lan
```

O comando compila o jogo, encontra o IPv4 do adaptador Wi-Fi e serve a prévia na porta 5183. Abra no celular o endereço mostrado no terminal, usando a mesma rede. É possível definir `LAN_HOST` e `LAN_PORT` se necessário. Esse endereço HTTP permite testar o jogo pela rede; instalação e cache offline no celular exigem HTTPS. Se o endereço funcionar no computador, mas não no celular, verifique a permissão do Node.js no Firewall do Windows para redes privadas.

No celular, jogue com a tela na horizontal. Se o aparelho estiver na vertical, o jogo mostra um aviso e pausa a simulação até a rotação; o progresso da batalha continua do mesmo ponto.

### Laboratório de sombras

Abra `/qa-sombras.html` no mesmo endereço do jogo (por exemplo, `http://127.0.0.1:5182/qa-sombras.html`). A página separada mostra três casas, três árvores, quatro pedras, cinco plantas, postes, poço, banco, caixotes, herói, três NPCs e três monstros sobre o chão da cidade. Ajuste a direção e elevação do sol, altura física geral dos sprites, comprimento, escuridão, contato, borda e zoom. A seção **Sombras por grupo** oferece controles independentes de posição e altura para personagens, casas, árvores, pedras, plantas e objetos gerais. Os filtros isolam cada grupo na cena. Ative as âncoras para comparar a base dourada da imagem com o início azul da sombra deslocada. **Copiar parâmetros** gera os valores e um link que reabre a mesma configuração. O preset **Jogo atual** usa a calibração aprovada em `src/render/shadowCalibration.ts`; novos ajustes no laboratório permanecem locais até serem incorporados ao jogo.

## Controles

| Ação | Desktop | Celular |
| --- | --- | --- |
| Andar | WASD ou setas | Toque e arraste na lateral esquerda para abrir o joystick transparente |
| Interagir e confirmar | Z | Botão Interagir |
| Pular, inclusive na arena | Espaço | Botão Pular |
| Pausar | Esc ou menu | Menu |
| Atacar, esquivar, perseguir, voltar | Z, X, C, V (ou 1, 2, 3, 4) | Botões ao lado do herói; Perseguir troca por Voltar |
| Enviar monstro a um ponto | Clique no chão da arena | Toque no chão da arena |
| Usar carta | B ou botão Cartas | Botão Cartas |
| Organizar inventário e mochila | I ou botão Mochila, fora da batalha | Botão Mochila, fora da batalha |
| Abrir mochila rápida na batalha | Q para abrir/fechar; segure para consultar | Botão Mochila ao lado do herói ou na barra inferior |
| Selecionar e usar item preparado | 1–6 ou setas; Z confirma | Toque no espaço e em Usar |
| Trocar monstro | Botão Equipe | Botão Equipe |
| Sair de encontro selvagem | F ou botão | Botão Sair da arena |

Para capturar, reduza o monstro selvagem a 50% da vida ou menos e use uma carta do mesmo elemento. A chance aparece no menu. O Ateliê de Cartas concede outra carta após vitórias selvagens; as cartas do mapa e os selos também fornecem recursos. Monstros evoluem no nível 6. Os três santuários encerram o objetivo da região, mas a exploração continua.

Cada espécie tem ataque, defesa, velocidade, sorte e área de ataque. A velocidade encurta o intervalo de golpes, acelera o movimento e reduz a recarga da esquiva; a defesa reduz o dano; a sorte aumenta a chance de crítico. O círculo no chão mostra a área que será atingida. A esquiva precisa tirar o monstro do círculo antes do impacto. Depois de golpear, o inimigo para brevemente. Objetos e suas sombras suavemente desaparecem da arena na entrada e reaparecem durante o zoom de saída. O companheiro acompanha o herói por padrão. **Atacar** ordena uma investida e um único golpe, seguido de retorno automático. **Perseguir** faz o companheiro caçar e atacar continuamente; nessa ordem, o botão muda para **Voltar**. Um toque no chão envia o monstro ao ponto e ele retorna ao herói em seguida. A coleção mostra os atributos e a experiência até o próximo nível.

O inventário guarda os itens coletados que não estão preparados; ao colocar uma unidade na mochila, ela sai da lista inferior, e volta ao retirá-la. A mochila de batalha tem seis espaços; cada pão, poção ou artefato ocupa um espaço separado. Itens de cura também podem ser usados na exploração: selecione o item, toque em **Usar agora** e escolha uma criatura no modal com barras de vida. O card mostra a cura antes de retornar ao inventário. Durante a luta, Q troca os comandos pela mochila rápida, escurece a arena e pausa o combate enquanto você escolhe. Toque ou clique diretamente no item para usá-lo; pelo teclado, selecione com 1–6 ou setas e confirme com Z.

Na ficha de cada criatura há um espaço para comida e outro para poção ou artefato. A escolha mostra unidades da mochila de batalha e do inventário; ao equipar uma unidade, ela deixa o espaço anterior e fica reservada para aquela criatura. O suporte ativa automaticamente quando ela entra na arena, após a invocação. A comida é consumida quando sua vida chega a 50% ou menos. Os dois usos aparecem sobre a criatura com o rótulo **AUTO**. Itens consumidos saem do inventário; os efeitos temporários duram 12 segundos.

## Estrutura

| Diretório | Responsabilidade |
| --- | --- |
| `src/game/content.ts` | Espécies, elementos, atributos e evolução |
| `src/game/world.ts` | Geração por semente, relevo, colisão e caminhos |
| `src/game/biomeArt.ts` | Catálogo tipado dos 80 tiles, pares de chão/parede, quatro camadas por bioma e kits de objetos |
| `src/game/battle/` | Cálculos de dano, velocidade e captura |
| `src/game/game.ts` | Simulação em passos fixos, IA, comandos, encontros e progressão |
| `src/game/save.ts` | Salvamento local versionado |
| `src/input/` | Teclado, mouse e toque |
| `src/render/` | Cena R3F: terreno e objetos visíveis por bloco, sprites, sombras, arena, luz e efeitos |
| `src/render/terrainPalette.ts` | Seleção da base fixa e da parede correspondente a cada bioma |
| `src/render/TerrainBrush.ts` | Máscara contínua de caminhos, manchas densas, margens e detalhes por semente |
| `src/render/TerrainChunks.tsx` | Composição das quatro camadas com bordas suaves em coordenadas do mundo |
| `src/render/ProjectedShadows.ts` e `sun.ts` | Silhuetas dos PNGs projetadas no relevo e direção solar fixa |
| `src/render/shadowCalibration.ts` | Valores aprovados para sol e sombras e classificação dos assets em seis grupos |
| `src/render/GroundShadows.tsx` | Sombra curta na borda, face e piso inferior dos desníveis |
| `src/render/spriteAnchors.ts` | Altura do último pixel opaco de cada quadro, usada para apoiar imagem e sombra no mesmo ponto |
| `src/qa-shadows/` | Laboratório separado de iluminação e silhuetas, com parâmetros compartilháveis |
| `src/ui/` | Telas, HUD, diálogos e controles responsivos |
| `assets/source/` | Imagens originais geradas para o jogo |
| `public/art/` | Atlases e PNGs normalizados usados no navegador |
| `scripts/build-art.mjs` | Recorte, escala e empacotamento dos assets |

`npm run art:build` recompõe os arquivos de `public/art/` a partir de `assets/source/`. Consulte [a direção de arte](assets/ART_DIRECTION.md) para o inventário e os briefs de criação. O HTML em `index.html` é apenas o ponto de montagem da aplicação React.
Se trocar PNGs já empacotados sem reconstruir toda a arte, execute `npm run art:anchors` para atualizar as âncoras dos pixels inferiores.

## Verificar

```sh
npm test
npm run build
```

Os testes cobrem geração reproduzível, acesso a santuários, cartas e portas com a colisão das imagens, colisão em alturas e casas, batalha automática e comandos, pausa dos menus, captura e consumo de cartas, horário, evolução, salvamento, conclusão dos três selos, sombras dos sprites, leitura dos desníveis e movimento reproduzível das sombras das nuvens.

Com o servidor de desenvolvimento na porta 5182, `node scripts/qa-battle.mjs` registra capturas da arena em desktop e celular horizontal na pasta `qa/` e verifica os botões e o layout por toque. Defina `QA_URL` se o servidor usar outro endereço.
