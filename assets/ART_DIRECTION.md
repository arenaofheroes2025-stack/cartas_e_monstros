# Direção de arte e inventário

Assets finais criados com o gerador de imagens integrado e normalizados com Sharp. Os PNGs em `source/` são as matrizes de arte; os PNGs em `../public/art/` são os arquivos prontos para o jogo. A arte original combina fantasia acolhedora, formas legíveis em escala pequena, contornos escuros e uma paleta de fogo coral, água turquesa e natureza verde dourada.

## Briefs visuais consolidados

- **Criaturas:** cada uma das 12 formas tem uma prancha de seis poses em grade 3 × 2, fundo transparente, mesma identidade e escala entre quadros: repouso, caminhada, ataque, esquiva, dano e evolução. Brasito/Brasalto são salamandras de brasa; Cinzuri/Vulcazuri, raposas vulcânicas; Gotejo/Maréjo, axolotes de água; Conchilo/Coracilo, tartarugas de concha marinha; Brotelho/Cervaflor, cervos florais; Musgato/Floragato, felinos de musgo.
- **Personagens:** aventureiro com poses de movimento em grade 3 × 2, quatro NPCs fixos e quatro moradores com tiras de três poses para repouso e caminhada: cartógrafa, botânico, padeiro e mensageira.
- **Cenário:** cinco pranchas 4 × 4 empacotadas como um atlas 4 × 20 de 80 tiles: chão original, variações originais, 16 ambientes detalhados, 16 transições e 16 paredes de rocha sem mato. Três pranchas adicionais 4 × 4 fornecem 48 objetos independentes para floresta, campo, montanha, rocha, deserto, vulcão, gelo, pântano, rio, lago, praia, estrada, ruínas, cidade, magia e caverna. Três casas acessíveis, duas casas complementares na vila, duas construções decorativas, três santuários e os objetos anteriores permanecem.
- **Interface:** cartas de fogo, água e natureza com moldura simples e símbolo elemental grande, legível no mapa; três interiores ilustrados; ícone de aplicativo; trio elemental transparente para a tela inicial.
- **Efeitos:** seis imagens transparentes para impacto de fogo, água e natureza, captura, evolução e selo.

As construções, árvores, personagens e cartas ficam verticalmente fixos sobre o terreno. A câmera ortográfica também mantém orientação fixa. A altura aparente dos sprites compensa a inclinação da câmera, preservando a proporção da imagem original; os quatro moradores ambulantes mudam de quadro e direção enquanto caminham. `scripts/build-sprite-anchors.mjs` mede a última linha opaca de cada quadro; a imagem e sua sombra usam esse mesmo pixel como ponto de contato, sem uma camada adicional sob os pés. O sol diurno tem direção diagonal fixa, à esquerda e acima na imagem, com elevação alta para produzir sombras curtas. À noite, casas, lanternas, santuários e cartas próximas acrescentam brilho local. `src/render/ProjectedShadows.ts` projeta o alfa dos próprios PNGs de árvores, casas, objetos, herói, NPCs e monstros sobre as alturas reais do terreno; as sombras acompanham a câmera e perdem força à noite. Não são usadas elipses genéricas como sombras dos objetos. `src/render/GroundShadows.tsx` sombreia a borda superior, a face e o piso inferior de cada queda, respeitando a mesma direção. Uma máscara procedural de nuvens atravessa o mapa durante o dia. O material da arte conserva uma parcela emissiva para que as cores continuem legíveis ao anoitecer. O laboratório em `/qa-sombras.html` permite comparar parâmetros sem alterar o jogo.

## Arquivos de origem

- `source/creatures/`: 12 pranchas de criaturas.
- `source/people/`: aventureiro e NPCs.
- `source/environment/terrain-atlas.png` e `terrain-variants.png`: pranchas originais preservadas dos 32 tiles antigos.
- `source/environment/terrain-biome-detailed.png`, `terrain-transitions-detailed.png` e `terrain-cliff-stone.png`: extensões no mesmo estilo detalhado da arte original; as paredes são rocha limpa, sem vegetação incorporada.
- `source/environment/terrain-rock-bare.png` e `dirt-road-bare.png`: superfícies de pedra e estrada sem mato incorporado. O script substitui as células correspondentes do atlas final.
- `source/environment/water-clear.png`: água turquesa clara gerada a partir da célula aprovada no atlas de referência; substitui a célula 6, mantendo-a independente das margens.
- `source/environment/terrain-clean-atlas.png`, `terrain-biome-library.png`, `terrain-transitions.png` e `terrain-subtle-variants.png`: estudos anteriores preservados como fonte de referência; o build não os usa.
- `source/environment/biome-props-core.png`, `biome-props-climate.png`, `biome-props-culture.png`: 48 objetos recortados individualmente em `public/art/environment/`. Os nomes e os kits de cada ambiente estão em `src/game/biomeArt.ts`.
- `source/environment/single/`: seis sprites adicionais isolados para recorte seguro, gerados individualmente com fundo transparente.
- `source/environment/houses-variants.png`: cabana do lenhador e casa de barcos; outros arquivos da pasta guardam casas, santuários, props, cartas e efeitos anteriores.
- `source/environment/cards-simple/`: as três cartas finais geradas individualmente com fundo transparente. O antigo `cards.png` fica como histórico de arte; o build usa estas fontes simplificadas.
- `source/environment/town-houses.png`: padaria e casa da vila em prancha transparente de duas células.
- `source/environment/town-props.png`: poste, arbusto florido, banco, poço, caixas e floreira em prancha transparente de seis células.
- `source/people/baker-walk.png` e `courier-walk.png`: três poses alinhadas de cada novo morador.
- `source/interiors/`: ambientes internos.
- `source/ui/`: ícone e ilustração da tela inicial; `hero-satchel.png` é a sacola de couro inspirada na que o aventureiro usa no sprite, exportada em 128 px para a mochila.

O script `npm run art:build` recorta as pranchas, mantém os pés alinhados na base de cada quadro, cria tiras de animação e retratos, extrai os itens de cenário e reamostra o atlas. As casas são extraídas em 512 px e os moradores ambulantes em 384 px, com redução suave para preservar detalhes. `build-footprints.mjs` extrai máscaras dos pixels alfa da base dos objetos e personagens; para casas, gera uma máscara bidimensional que representa a área ocupada entre a parede e os degraus.

As imagens novas desta expansão foram geradas com a ferramenta integrada de imagens. Os prompts pediram um atlas complementar 4 × 4 com variações de floresta, pântano, vulcão e vila; dois edifícios em uma prancha transparente; e seis objetos isolados — pinheiro, árvore de cobre, salgueiro, rocha musgosa, rocha basáltica e arbusto florido — no estilo dos assets já aprovados, sem cenário ou sombra incorporada. A primeira folha conjunta dos objetos não foi usada porque as silhuetas ultrapassaram as células; cada objeto final foi gerado isoladamente.

A ampliação da vila também usou a ferramenta integrada de imagens, tomando as casas, props e moradores existentes apenas como referência visual. Os prompts pediram uma padaria e uma casa azul em vista isométrica; seis objetos urbanos separados em grade 3 × 2; e, em chamadas próprias, tiras de três poses para um padeiro e uma mensageira. Todos foram salvos em `source/` e normalizados para `public/art/`.

## Composição dos Tile Maps

As extensões finais foram geradas com o atlas original como referência visual. Os prompts pediram 16 pisos detalhados para os biomas do catálogo, 16 superfícies intermediárias, 16 faces verticais de penhasco sem grama, quatro superfícies de rocha sem vegetação e uma estrada de terra limpa. As três pranchas transparentes de objetos pediram bases alinhadas e sprites independentes para floresta/campo/rocha/vulcão, deserto/gelo/pântano/rio e cidade/ruínas/magia/caverna. O atlas simples de uma tentativa anterior foi descartado porque não combinava com as árvores e casas existentes.

`src/game/biomeArt.ts` define **16 perfis** com um piso base, uma parede correspondente e quatro superfícies adicionais: caminho, mancha densa, detalhe de contexto e acento. A região atual usa os perfis de floresta, vulcão e lago; os demais já têm arte e regra catalogadas para regiões futuras. `src/render/terrainPalette.ts` escolhe o piso base pelo bioma e deixa somente pontes, rampas, praças e santuários como superfícies especiais. Uma estrada, pedra ou mancha de vegetação não substitui o quadrado inteiro.

`src/render/TerrainBrush.ts` produz uma máscara RGBA de 96 × 96 para o mundo. O canal vermelho marca estradas; os demais desenham grupos orgânicos por ruído de baixa frequência, proximidade de água e relevo. Na floresta, dois ruídos de escalas diferentes produzem faixas verde-claras e manchas de folhagem escura sobre o piso base. Uma segunda máscara pinta a pedra da vila sobre o chão da floresta e espalha fragmentos suaves no perímetro; as ruas próximas às casas usam essa mesma pedra. No shader, as máscaras usam filtragem linear, pequena distorção espacial fixa e bordas esmaecidas, sem depender dos limites dos blocos de 16 × 16. A textura de terra limpa é pintada por último nos caminhos fora da vila, sem grama. Tiles de biomas diferentes recebem uma mistura suave na borda. Penhascos usam a parede declarada no mesmo perfil, em faixas de altura, sem vegetação pré-pintada. Objetos pequenos e estruturas ficam em camadas independentes.

A água usa a nova célula clara inspirada no atlas de referência, deslocada suavemente em coordenadas do mundo. A cor da própria imagem é preservada no material em vez de substituída por um brilho azul uniforme. A primeira região continua com três biomas de encontros, enquanto o catálogo maior evita misturar superfícies incompatíveis quando novas regiões forem adicionadas.
