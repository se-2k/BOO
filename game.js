(() => {
  'use strict';

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d', { alpha: false });
  const W = 390;
  const H = 844;
  const GROUND = 770;                 // 부와 말티즈는 도로 위(가까운 차선)를 달린다
  const SPACE_START = 5550;
  ctx.imageSmoothingEnabled = false;

  // ---- 속도감: 크롬 공룡 게임(dinorunner)의 상수를 그대로 사용 ----
  // 공룡 게임은 600px 폭 캔버스에서 프레임(1/60초)당 6px로 시작해 13px까지,
  // 매 프레임 0.001px씩 가속한다. 이 게임은 폭이 390px이므로 화면 폭 비율로
  // 환산해 "화면을 가로지르는 시간"이 공룡 게임과 똑같아지도록 맞춘다.
  const DINO_FPS = 60;
  // 화면 폭 비율(390/600=0.65)로만 환산하면 부의 큰 몸에 비해 느리게 느껴져서 0.75로 조금 키웠다.
  const K = 0.75;
  const dino = (pxPerFrame) => pxPerFrame * DINO_FPS * K;      // px/frame -> px/s
  const MIN_SPEED = dino(6);                                    // 270 px/s (K=0.75)
  const MAX_SPEED = dino(13);                                   // 585 px/s (K=0.75)
  const ACCELERATION = dino(0.001) * DINO_FPS;                  // 초당 가속 2.7 px/s² (약 117초 후 최고 속도)
  const AIR_OBSTACLE_MIN_SPEED = dino(8.5);                     // 익룡처럼 공중 장애물은 이 속도부터
  const GAP_COEFFICIENT = 0.6;
  const MAX_GAP_COEFFICIENT = 1.5;
  const MAX_OBSTACLE_DUPLICATION = 2;
  // 점프 체공시간은 공룡 게임(약 0.56초)에 가깝게 0.6초. 공룡 게임에서 "점프 거리 대비 공룡+선인장 폭" 비율이
  // 약 35%인데, 부는 몸이 커서 장애물 폭을 줄이고 체공을 조금 늘려 비슷한 여유(약 0.2초)를 만든다.
  const JUMP_VELOCITY = -855;                                   // 체공 0.66초, 최고 141px
  const GRAVITY = 2590;

  const BOO_X = 84;
  const DOG_X = 10;
  const BOO_FOOT_X = BOO_X + 51;
  const DOG_FOOT_X = DOG_X + 38;
  const DOG_GAP = BOO_X - DOG_X;                                // 말티즈는 부가 지나간 자리를 그대로 따라 달린다
  const BOO_SCALE = 0.34;
  const DOG_SCALE = 51 / 346;

  const $ = (id) => document.getElementById(id);
  const startPanel = $('startPanel');
  const gameOverPanel = $('gameOverPanel');
  const pauseButton = $('pauseButton');
  const pauseBadge = $('pauseBadge');
  const previewRegion = $('previewRegion');
  const startButton = $('startButton');

  const foods = [
    { id: 'potato', name: '감자빵', short: '감자', color: '#b96c38' },
    { id: 'corn', name: '옥수수', short: '옥수수', color: '#ffd94b' },
    { id: 'ramen', name: '치즈라면', short: '라면', color: '#ef5a43' },
  ];

  const regions = [
    {
      id: 'osan', name: '오산', subtitle: '역광장로 · 오산로 · 경기대로', start: 0, end: 700,
      sky: '#86cdf2', far: '#b4cde0', mid: '#dce5e4', ground: '#3c4045', sidewalk: '#cfd4d8', accent: '#276da6',
      tile: 'osanStreet', signs: ['역광장로', '오산로', '경기대로'],
      landmarks: [
        { at: 70, type: 'osanStation', name: '오산역 환승센터', detail: '역광장로 59 · 철로 위 입체 환승센터' },
        { at: 220, type: 'osakMarket', name: '오색시장', detail: '오산 도심의 오래된 전통시장' },
        { at: 390, type: 'haedong', name: '해동검도 기드온', detail: '경기대로 105 · 로얄프라자' },
        { at: 570, type: 'hapkido', name: '한라합기도', detail: '원동·갈곶 생활권 합기도장' },
      ],
    },
    {
      id: 'dongtan', name: '병점 · 동탄', subtitle: '병점역 · 동탄역로 · 동탄대로', start: 700, end: 1800,
      sky: '#8dd3f5', far: '#aac4da', mid: '#d9e3e8', ground: '#3a3e44', sidewalk: '#d3d7db', accent: '#df5a42',
      tile: 'newTown', signs: ['병점역로', '동탄역로', '동탄대로'],
      landmarks: [
        { at: 770, type: 'byeongjeom', name: '병점역 광장', detail: '1호선 병점역과 동부광장' },
        { at: 930, type: 'metapolis', name: '메타폴리스', detail: '동탄1신도시 고층 주상복합' },
        { at: 1090, type: 'dongtanStation', name: '동탄역', detail: 'SRT·GTX-A 지하역과 동탄역로' },
        { at: 1260, type: 'lotte', name: '롯데백화점 동탄점', detail: '동탄역로 160' },
        { at: 1430, type: 'lakeComo', name: '레이크꼬모', detail: '동탄대로 181 · 호수공원 연결 상업공간' },
        { at: 1580, type: 'luna', name: '동탄호수공원 루나분수', detail: '원형 조형물과 대형 음악분수' },
        { at: 1730, type: 'lakmon', name: '라크몽', detail: '동탄대로5길 21 · 호수 앞 복합문화시설' },
      ],
    },
    {
      id: 'sch', name: '신창 · 순천향대', subtitle: '후문 오르막 · 향설동문 · 걷고싶은 길', start: 1800, end: 4500,
      sky: '#93d6f3', far: '#a9c4b8', mid: '#d8dfc8', ground: '#41443f', sidewalk: '#d6d2c8', accent: '#1b5f92',
      tile: 'campus', signs: ['행목로', '순천향로', '걷고싶은 길'],
      landmarks: [
        { at: 1870, type: 'sinchang', name: '1호선 신창역', detail: '행목로 · 수도권 전철 1호선 종착역' },
        { at: 2090, type: 'schLake', name: '순천향호', detail: '신창역 방향 캠퍼스 서쪽 연못' },
        { at: 2320, type: 'eastGate', name: '향설동문 · 후문', detail: '후문 앞 대학가에서 캠퍼스로 이어지는 오르막' },
        { at: 2560, type: 'cZone', name: '학예관 · BRIX관', detail: '멀티미디어관·앙뜨레프레너관 인접' },
        { at: 2820, type: 'richVilla', name: '리치빌', detail: '후문 생활권의 주차 공간이 있는 대학가 원룸' },
        { at: 3100, type: 'sujiVilla', name: '수지빌', detail: '순천향로 25-8 · 오래된 대학가 빌라' },
        { at: 3380, type: 'greenHouseVilla', name: '그린하우스', detail: '초록 지붕과 발코니가 있는 후문 원룸' },
        { at: 3660, type: 'everTown', name: '에버타운', detail: '순천향로 47-48 일대의 원룸 건물군' },
        { at: 3940, type: 'breakfastBoard', name: '천원의 아침밥', detail: '학생식당 앞 아침 식사 안내 판넬' },
        { at: 4220, type: 'library', name: '향설도서관 · 대학본관', detail: '본관 앞 숲길과 대운동장' },
        { at: 4460, type: 'humanLove', name: '인간사랑관', detail: '캠퍼스 서문 방향 A01 건물' },
      ],
    },
    {
      id: 'gwangjin', name: '어린이대공원', subtitle: '음악분수 · 숲길 · 놀이동산 · 식물원', start: 4500, end: SPACE_START,
      sky: '#8cd2f0', far: '#aec6c9', mid: '#d9dfdc', ground: '#3d4043', sidewalk: '#d2ccc2', accent: '#2a8b5e',
      tile: 'gwangjin', signs: ['능동로', '광나루로', '광나루로13길'],
      landmarks: [
        { at: 4580, type: 'musicFountain', name: '어린이대공원 음악분수', detail: '원형 수조와 여러 갈래의 시원한 물줄기' },
        { at: 4800, type: 'seoulForest', name: '숲속 산책로', detail: '큰 나무와 벤치가 이어지는 그늘길' },
        { at: 5010, type: 'octagon', name: '어린이대공원 놀이동산', detail: '회전목마 · 관람차 · 알록달록한 놀이기구' },
        { at: 5240, type: 'greenhouse', name: '식물원과 연못', detail: '유리 온실 · 꽃밭 · 연못 산책길' },
        { at: 5460, type: 'parkGate', name: '피크닉 정원', detail: '정자와 잔디밭이 있는 공원 안쪽 쉼터' },
      ],
    },
    {
      id: 'space', name: '우주', subtitle: '위·아래로 자유롭게 유영해요', start: SPACE_START, end: Infinity,
      sky: '#050611', far: '#101327', mid: '#171b32', ground: '#20243a', sidewalk: '#30344b', accent: '#9aa9d8',
      tile: 'space', signs: ['지구에서 5,550m', '고요한 무중력', '계속 유영하는 중'],
      landmarks: [
        { at: 5640, type: 'earth', name: '고요한 무중력 우주', detail: '장애물 없이 위·아래로 자유롭게 날아요' },
        { at: 6000, type: 'moon', name: '별과 행성 사이', detail: '말티즈와 함께 끝없이 유영해요' },
      ],
    },
  ];

  const obstacleKinds = {
    osan: [
      { type: 'ground', label: '택배 상자', color: '#b57242' },
      { type: 'air', label: '상가 간판', color: '#347eb2' },
      { type: 'ground', label: '교통콘', color: '#ed6a35' },
    ],
    dongtan: [
      { type: 'ground', label: '공사 펜스', color: '#f0b33c' },
      { type: 'air', label: '버스 표지', color: '#347eb2' },
      { type: 'ground', label: '화분', color: '#5a9665' },
    ],
    sch: [
      { type: 'ground', label: '책 상자', color: '#a96a42' },
      { type: 'air', label: '축제 현수막', color: '#6e5ba7' },
      { type: 'ground', label: '캠퍼스 콘', color: '#ed6a35' },
    ],
    gwangjin: [
      { type: 'ground', label: '공원 화분', color: '#4e8b5f' },
      { type: 'air', label: '골목 간판', color: '#e15545' },
      { type: 'ground', label: '벤치', color: '#8d6548' },
    ],
    space: [
      { type: 'ground', label: '월석', color: '#807899' },
      { type: 'air', label: '인공위성', color: '#89b9d0' },
    ],
  };

  const state = {
    mode: 'menu', paused: false, previewMode: false, distance: 0, worldX: 0, score: 0, speed: MIN_SPEED,
    playerY: 0, playerVY: 0, ducking: false, duckHeld: false, duckTimer: 0, speedDrop: false,
    runPhase: 0, dogPhase: 0, trail: [], landTimer: 0, lastStep: 0, upHeld: false, downHeld: false,
    obstacles: [], pickups: [], landmarks: [], particles: [],
    counts: Object.fromEntries(foods.map((f) => [f.id, 0])),
    firstObstacleAt: 1.6, nextPickup: 0.75, elapsed: 0,
    currentRegion: regions[0], previousRegionId: null, regionBanner: 0,
    landmarkCaption: null, landmarkCaptionTime: 0,
    seenLandmarks: new Set(), lastFrame: performance.now(),
  };

  // ---- 스프라이트와 지역 파노라마 ----
  // v10 달리기는 크기와 중심점을 정규화한 8개의 고유 동작을 균등한 시간으로 사용한다. 배경은 지역마다 실제 장소의
  // 건축적 특징을 담은 긴 파노라마 한 장 안에 여러 거리 구간이 이어지는 구조다.
  const sprites = {};
  const backgrounds = {};
  const spriteSources = [
    ['boo', 'assets/boo-game.png', { srcW: 162, srcH: 512 }],
    ['dog', 'assets/maltese-game.png', { srcW: 498, srcH: 420 }],
    ['booRun', 'assets/boo-run-sheet-v10.png', { srcW: 300, srcH: 520, frames: 8, fw: 300, fh: 520, dy: 10 }],
    ['dogRun', 'assets/maltese-run-sheet.png', { srcW: 512, srcH: 346, frames: 6, fw: 498, fh: 376, dx: 7, dy: 7 }],
    ['booDuck', 'assets/boo-duck-game.png', { srcW: 512, srcH: 186 }],
    ['dogDuck', 'assets/maltese-duck-game.png', { srcW: 512, srcH: 240 }],
    ['booFloat', 'assets/boo-float-sheet-v8.png', { srcW: 390, srcH: 360, frames: 6, fw: 390, fh: 360 }],
    ['dogFloat', 'assets/maltese-float-sheet-v8.png', { srcW: 390, srcH: 300, frames: 6, fw: 390, fh: 300 }],
    ['professors', 'assets/professors-v8.png', { srcW: 600, srcH: 820, frames: 2, fw: 600, fh: 820 }],
    ['profFight', 'assets/professor-fight-sheet-v10.png', { srcW: 543, srcH: 724, frames: 4, fw: 543, fh: 724 }],
    ['villas', 'assets/sch-villas-v8.png', { srcW: 520, srcH: 820, frames: 4, fw: 520, fh: 820 }],
  ];
  const backgroundSources = [
    ['osan', 'assets/backgrounds/osan-panorama-v7.png'],
    ['dongtan', 'assets/backgrounds/dongtan-panorama-v7.png'],
    ['sch', 'assets/backgrounds/sch-panorama-v8.png'],
    ['gwangjin', 'assets/backgrounds/gwangjin-panorama-v7.png'],
    ['space', 'assets/backgrounds/space-panorama-v8.png'],
  ];

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = src;
    });
  }

  startButton.disabled = true;
  startButton.textContent = '거리와 캐릭터 불러오는 중…';
  Promise.all([
    ...spriteSources.map(async ([key, src, meta]) => {
      const image = await loadImage(src);
      sprites[key] = {
        image, srcW: meta.srcW, srcH: meta.srcH,
        frames: meta.frames || 1, fw: meta.fw || image.naturalWidth, fh: meta.fh || image.naturalHeight,
        dx: meta.dx || 0, dy: meta.dy || 0,
      };
    }),
    ...backgroundSources.map(async ([key, src]) => {
      backgrounds[key] = await loadImage(src);
    }),
  ]).then(() => {
    startButton.disabled = false;
    startButton.textContent = '달리기 시작';
  }).catch((error) => {
    console.error('게임 이미지를 불러오지 못했습니다.', error);
    startButton.textContent = '이미지 파일을 확인해 주세요';
  });

  // ---- 음식 픽셀아트 (16x16, 2px 단위로 그림) ----
  const FOOD_PALETTE = {
    o: '#3a2414', b: '#c0955f', B: '#d6b07c', d: '#7d4f2a', D: '#4e2f19', l: '#ead0a2', y: '#f6d979', Y: '#fdeeb0',
    k: '#f2c12e', K: '#ffe268', s: '#c98d17', g: '#3f9640', G: '#2a7130', h: '#7fc463',
    p: '#d9a33d', P: '#f3cf6b', q: '#a3741f', r: '#df3f2b', R: '#f26a3e', n: '#f6d97a', c: '#fff3ab', C: '#eec84f', e: '#3d3d3d', v: '#48a54a', w: '#ffffff',
    a: '#232323', A: '#3b3b3b', i: '#e2622b', I: '#f08a48', j: '#c0392b', t: '#fff7e4', T: '#f5b52d', z: '#3d9440',
  };
  const FOOD_ART = {
    // 메가커피 감자빵: 감자처럼 얼룩진 갈색 겉면, 한 입 베어낸 곳에 노란 감자 속
    potato: [
      '................',
      '....oooooo......',
      '..ooBBBlBBoo....',
      '.oBBlBBBbbbboo..',
      '.oBlBBbbbDbbbbo.',
      'oBBBbbbbbbbdbbbo',
      'oBbbDbbbbbbbbbYo',
      'obbbbbbbdbbbYYyo',
      'obdbbbbbbbbYyyyo',
      'obbbbDbbbbdyyyo.',
      '.obbbbbbbbbbyo..',
      '.oobbdbbbDbbo...',
      '...oobbbbboo....',
      '.....ooooo......',
      '................',
      '................',
    ],
    // 옥수수: 알알이 박힌 노란 옥수수와 양쪽으로 벌어진 초록 껍질
    corn: [
      '......oo........',
      '.....okKo.......',
      '....okKkKo......',
      '....oKkKko......',
      '...ookKkKoo.....',
      '..ogoKkKkogo....',
      '..oGokKkKoGo....',
      '..ogoKkKkogo....',
      '.ohgoskKsogho...',
      '.oGgokKkKoGGo...',
      '.oGgoskKsogGo...',
      '.ogGokKkKoGgo...',
      '..oGGoskoGGo....',
      '..ohGGooohGo....',
      '...oGGo.oGGo....',
      '....oo...oo.....',
    ],
    // 치즈라면: 노란 양은냄비에 빨간 국물, 꼬불면 위에 녹아내리는 치즈 한 장과 파
    ramen: [
      '................',
      '....wo..........',
      '....ow.oo..o....',
      '.....oo.wo.o....',
      '....ooooooooo...',
      '..oopPPPPPPpoo..',
      '.oeoqrRrnrRrqoeo',
      'oeoorrnnCccnrooe',
      '.oooqrnCcccnroo.',
      '..oopRrnccCrpo..',
      '..oppPnrvrnPpo..',
      '..oPpppvpppPPo..',
      '..opPPPPPPPPpo..',
      '..oqpqqqqqqqqo..',
      '...ooooooooooo..',
      '................',
    ],
  };
  const FOOD_CELL = 2;
  const FOOD_SIZE = 16 * FOOD_CELL;
  const foodCanvases = {};
  for (const food of foods) {
    const off = document.createElement('canvas');
    off.width = FOOD_SIZE; off.height = FOOD_SIZE;
    const c = off.getContext('2d');
    FOOD_ART[food.id].forEach((row, y) => {
      [...row].forEach((ch, x) => {
        if (ch === '.') return;
        c.fillStyle = FOOD_PALETTE[ch];
        c.fillRect(x * FOOD_CELL, y * FOOD_CELL, FOOD_CELL, FOOD_CELL);
      });
    });
    foodCanvases[food.id] = off;
  }

  function regionAt(distance) {
    return regions.find((region) => distance >= region.start && distance < region.end) || regions.at(-1);
  }

  function smoothstep01(value) {
    const t = Math.max(0, Math.min(1, value));
    return t * t * (3 - 2 * t);
  }

  // 실제 주행면의 고도. 지역 경계에서도 높이가 끊기지 않도록 각 구간의
  // 시작·끝 고도를 이어 놓았다. 순천향대는 후문에서 캠퍼스 안쪽으로 갈수록
  // 총 64px 높아지고, 중간의 오르막과 완만한 평지가 반복된다.
  function terrainOffsetAtDistance(distance) {
    const d = Math.max(0, distance);
    const region = regionAt(d);
    if (region.id === 'space') return 0;
    const span = region.end - region.start;
    const rel = d - region.start;
    const p = Math.max(0, Math.min(1, (d - region.start) / span));
    const edgeRamp = Math.max(0, Math.min(1, rel / 42, (region.end - d) / 42));
    if (region.id === 'osan') return 6 * Math.sin(rel / 26) * edgeRamp;
    if (region.id === 'dongtan') return -6 * smoothstep01(p) + 3 * Math.sin(rel / 38) * edgeRamp;
    if (region.id === 'sch') return -6 - 64 * smoothstep01(p) + 22 * Math.sin(rel / 28) * edgeRamp;
    if (region.id === 'gwangjin') return -70 + 50 * smoothstep01(p) + 10 * Math.sin(rel / 35) * edgeRamp;
    return 0;
  }

  function groundAtScreenX(x) {
    const distanceAtX = state.distance + (x - BOO_FOOT_X) / 14;
    return GROUND + terrainOffsetAtDistance(distanceAtX);
  }

  function groundAngleAtScreenX(x) {
    const sample = 7;
    return Math.atan2(groundAtScreenX(x + sample) - groundAtScreenX(x - sample), sample * 2);
  }

  function pickupY(pickup) {
    return groundAtScreenX(pickup.x) - pickup.height;
  }

  function resetGame(startChoice = 0) {
    const choice = String(startChoice);
    const tourMode = choice.startsWith('tour:');
    const startDistance = Number(tourMode ? choice.slice(5) : choice) || 0;
    state.mode = 'playing';
    state.paused = false;
    state.distance = startDistance;
    state.worldX = state.distance * 3;
    state.previewMode = tourMode;
    state.score = Math.floor(state.distance);
    state.speed = MIN_SPEED;
    state.playerY = 0;
    state.playerVY = 0;
    state.ducking = false;
    state.duckHeld = false;
    state.duckTimer = 0;
    state.speedDrop = false;
    state.runPhase = 0;
    state.dogPhase = 0;
    state.upHeld = false;
    state.downHeld = false;
    state.landTimer = 0;
    state.lastStep = 0;
    state.trail.length = 0;
    state.obstacles.length = 0;
    state.pickups.length = 0;
    state.landmarks.length = 0;
    state.particles.length = 0;
    state.counts = Object.fromEntries(foods.map((f) => [f.id, 0]));
    state.firstObstacleAt = 1.6;
    state.nextPickup = 0.65;
    state.elapsed = 0;
    state.currentRegion = regionAt(state.distance);
    if (state.currentRegion.id === 'space') {
      state.playerY = -170;
      state.playerVY = 0;
    }
    state.previousRegionId = null;
    state.regionBanner = 3.2;
    state.landmarkCaption = null;
    state.landmarkCaptionTime = 0;
    state.seenLandmarks = new Set();
    touchStart = null;
    startPanel.hidden = true;
    gameOverPanel.hidden = true;
    pauseButton.hidden = false;
    pauseBadge.hidden = true;
  }

  const onGround = () => state.playerY >= 0;

  function jump() {
    if (state.mode !== 'playing' || state.paused) return;
    if (state.currentRegion.id === 'space') {
      state.playerVY = Math.max(-260, state.playerVY - 145);
      return;
    }
    if (onGround()) {
      state.playerVY = JUMP_VELOCITY;
      state.playerY = -0.01;
      state.speedDrop = false;
      burst(BOO_FOOT_X, groundAtScreenX(BOO_FOOT_X) - 6, '#e8d6bd', 6);
    }
  }

  // ↓ 입력: 땅에서는 엎드리기만 한다. 공중에서는 낙하 속도나 점프 높이에 영향을 주지 않는다.
  function pressDown() {
    if (state.mode !== 'playing' || state.paused) return;
    if (state.currentRegion.id === 'space') {
      state.downHeld = true;
      state.playerVY = Math.min(260, state.playerVY + 110);
      return;
    }
    state.duckHeld = true;
  }

  function releaseDown(keepFor = 0) {
    state.downHeld = false;
    state.duckHeld = false;
    state.speedDrop = false;
    state.duckTimer = Math.max(state.duckTimer, keepFor);
  }

  function togglePause() {
    if (state.mode !== 'playing') return;
    state.paused = !state.paused;
    pauseBadge.hidden = !state.paused;
  }

  function gameOver() {
    state.mode = 'over';
    state.paused = false;
    pauseButton.hidden = true;
    pauseBadge.hidden = true;
    const best = Math.max(Number(localStorage.getItem('booRunnerBest') || 0), state.score);
    localStorage.setItem('booRunnerBest', String(best));
    $('resultDistance').textContent = `${Math.floor(state.distance)}m`;
    $('resultScore').textContent = state.score.toLocaleString('ko-KR');
    $('resultTitle').textContent = state.distance >= SPACE_START ? '우주까지 날아갔어요!' : `${state.currentRegion.name}에서 쉬어가요`;
    $('resultFoods').innerHTML = foods.map((food) => `<span><img src="${foodCanvases[food.id].toDataURL()}" alt="${food.name}" width="24" height="24"> ${state.counts[food.id]}</span>`).join('');
    $('bestScore').textContent = best === state.score ? '새로운 최고 기록!' : `최고 기록 ${best.toLocaleString('ko-KR')}점`;
    gameOverPanel.hidden = false;
  }

  // ---- 장애물: 공룡 게임의 간격 공식 ----
  // minGap = 장애물폭 × 속도 + 기본간격 × 0.6, maxGap = minGap × 1.5 (공룡 게임 단위로 계산 후 화면 폭에 맞게 환산)
  function obstacleGap(width) {
    const speedDino = state.speed / (DINO_FPS * K);
    const widthDino = (width * 0.4) / K;
    const formula = Math.round(widthDino * speedDino + 120 * GAP_COEFFICIENT) * K;
    const minGap = Math.max(formula, state.speed * 0.8);        // 착지 직후 다시 점프할 여유
    return minGap + Math.random() * minGap * (MAX_GAP_COEFFICIENT - 1);
  }

  function spawnObstacle() {
    let pool = obstacleKinds[state.currentRegion.id];
    if (state.speed < AIR_OBSTACLE_MIN_SPEED) pool = pool.filter((kind) => kind.type !== 'air');
    const recent = state.obstacles.slice(-MAX_OBSTACLE_DUPLICATION);
    if (recent.length === MAX_OBSTACLE_DUPLICATION && recent.every((o) => o.kind.label === recent[0].kind.label) && pool.length > 1) {
      pool = pool.filter((kind) => kind.label !== recent[0].kind.label);
    }
    const kind = pool[(Math.random() * pool.length) | 0];
    const width = kind.type === 'air' ? 54 : 28;
    state.obstacles.push({ x: W + 30, kind, width, gap: obstacleGap(width), passed: false });
  }

  function spawnPickupPattern() {
    const food = foods[(Math.random() * foods.length) | 0];
    const arc = Math.random() < .56;
    const amount = 3 + ((Math.random() * 3) | 0);
    for (let i = 0; i < amount; i += 1) {
      const t = amount === 1 ? 0 : i / (amount - 1);
      state.pickups.push({
        x: W + 30 + i * 36,
        height: arc ? 64 + Math.sin(t * Math.PI) * 93 : 48,
        food,
        bob: Math.random() * Math.PI * 2,
      });
    }
  }

  function spawnLandmarks() {
    const region = state.currentRegion;
    for (const landmark of region.landmarks) {
      const key = `${region.id}:${landmark.at}`;
      // 살펴보기로 랜드마크 직전에 진입해도 첫 렌더 사이에 놓치지 않도록 넉넉한 후방 창을 둔다.
      const arrivalWindow = state.distance >= landmark.at - 8 && state.distance <= landmark.at + 60;
      if (!state.seenLandmarks.has(key) && arrivalWindow) {
        state.seenLandmarks.add(key);
        state.landmarks.push({ ...landmark, x: W + 40, width: landmarkWidth(landmark.type) });
      }
    }
  }

  function landmarkWidth(type) {
    if (['luna', 'musicFountain', 'seoulForest', 'schLake', 'osanStation', 'seongsuStation', 'dongtanStation', 'osakMarket'].includes(type)) return 260;
    if (['cZone', 'dorms', 'bZone', 'library', 'flagships', 'understand', 'lakeComo', 'daelim', 'lotte', 'parkGate', 'metapolis', 'seongsuComplex'].includes(type)) return 240;
    return 200;
  }

  function update(dt) {
    if (state.mode !== 'playing' || state.paused) return;
    state.elapsed += dt;

    // 길게 누르기: 착지 후 손을 떼기 전까지 엎드린 채 유지
    if (state.currentRegion.id !== 'space' && touchStart && !touchStart.swiped && performance.now() - touchStart.time > 300) {
      touchStart.swiped = true;
      state.duckHeld = true;
    }
    state.duckTimer = Math.max(0, state.duckTimer - dt);

    // 공룡 게임: 매 프레임 ACCELERATION씩 가속, MAX_SPEED에서 멈춤
    state.speed = Math.min(MAX_SPEED, state.speed + ACCELERATION * dt);
    state.worldX += state.speed * dt;
    state.distance += state.speed * dt / 14;
    state.score = Math.floor(state.distance) + foods.reduce((sum, food) => sum + state.counts[food.id] * 10, 0);

    const nextRegion = regionAt(state.distance);
    if (nextRegion.id !== state.currentRegion.id) {
      state.previousRegionId = state.currentRegion.id;
      state.currentRegion = nextRegion;
      state.regionBanner = 3.5;
      state.obstacles.length = 0;
      if (nextRegion.id === 'space') {
        state.playerY = -170;
        state.playerVY = 0;
        state.duckHeld = false;
        state.ducking = false;
        state.speedDrop = false;
      }
    }
    state.regionBanner = Math.max(0, state.regionBanner - dt);
    state.landmarkCaptionTime = Math.max(0, state.landmarkCaptionTime - dt);

    if (state.currentRegion.id === 'space') {
      // 무중력: 위/아래 키는 추진, 손을 떼면 천천히 감속하며 유영한다.
      const thrust = (state.downHeld ? 1 : 0) - (state.upHeld ? 1 : 0);
      state.playerVY += thrust * 520 * dt;
      state.playerVY *= Math.pow(thrust ? .72 : .22, dt);
      state.playerY += state.playerVY * dt + Math.sin(state.elapsed * 1.7) * 5 * dt;
      if (state.playerY < -520) { state.playerY = -520; state.playerVY = Math.max(20, -state.playerVY * .35); }
      if (state.playerY > -20) { state.playerY = -20; state.playerVY = Math.min(-20, -state.playerVY * .35); }
      state.ducking = false;
      state.speedDrop = false;
      state.landTimer = 0;
    } else {
      // 점프 물리는 위·아래 입력과 완전히 분리한다. 공중에서 ↓를 눌러도
      // 상승 높이와 낙하 속도는 바뀌지 않는다.
      if (!onGround()) {
        state.playerVY += GRAVITY * dt;
        state.playerY += state.playerVY * dt;
        if (state.playerY >= 0) {
          state.playerY = 0;
          state.playerVY = 0;
          state.speedDrop = false;
          state.landTimer = .14;
          dust(BOO_X + 40, 6);
        }
      }
      state.landTimer = Math.max(0, state.landTimer - dt);
      state.ducking = onGround() && (state.duckHeld || state.duckTimer > 0);
    }

    // 달리기 애니메이션 위상: 속도가 빨라지면 발놀림도 빨라진다
    const tempo = Math.pow(MIN_SPEED / state.speed, .6);
    if (state.currentRegion.id === 'space') {
      state.runPhase = (state.runPhase + dt / 1.15) % 1;
      state.dogPhase = (state.dogPhase + dt / .95) % 1;
    } else if (onGround() && !state.ducking) {
      const before = state.runPhase;
      // 여덟 고유 자세를 같은 시간 간격으로 재생한다. 중복 프레임을 오래
      // 붙잡았다가 갑자기 다음 자세로 넘어가던 v9의 덜그럭거림을 없앴다.
      state.runPhase = (state.runPhase + dt / (.50 * tempo)) % 1;
      state.dogPhase = (state.dogPhase + dt / (.30 * tempo)) % 1;
      // 발이 땅에 닿는 순간(주기의 시작과 절반)에 작은 먼지
      if ((before < .5 && state.runPhase >= .5) || state.runPhase < before) dust(BOO_X + (state.runPhase < .5 ? 30 : 56), 2);
    }

    // 말티즈가 따라 달릴 수 있도록 부의 궤적을 기록
    state.trail.push({ w: state.worldX, y: state.playerY, duck: state.ducking, vy: state.playerVY });
    if (state.trail.length > 400) state.trail.splice(0, state.trail.length - 400);

    // 장애물 생성: 마지막 장애물 뒤로 정해진 간격이 화면 안에 들어오면 다음 장애물 등장
    if (state.currentRegion.id !== 'space' && !state.previewMode && state.elapsed >= state.firstObstacleAt) {
      const last = state.obstacles.at(-1);
      if (!last || last.x + last.width + last.gap < W) spawnObstacle();
    }

    state.nextPickup -= dt;
    if (state.nextPickup <= 0) {
      spawnPickupPattern();
      state.nextPickup = Math.max(.55, (215 + Math.random() * 170) / state.speed);
    }

    spawnLandmarks();
    const scroll = state.speed * dt;
    for (const obstacle of state.obstacles) obstacle.x -= scroll;
    for (const pickup of state.pickups) { pickup.x -= scroll; pickup.bob += dt * 5; }
    for (const landmark of state.landmarks) {
      landmark.x -= scroll;
      if (!landmark.captioned && landmark.x < W * .56) {
        landmark.captioned = true;
        state.landmarkCaption = landmark;
        state.landmarkCaptionTime = 4.2;
      }
    }
    for (const p of state.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 320 * dt;
      const particleGround = groundAtScreenX(p.x) - 2;
      if (p.y > particleGround) { p.y = particleGround; p.vy = 0; }
      p.life -= dt;
    }

    handleCollisions();
    state.obstacles = state.obstacles.filter((o) => o.x > -100);
    state.pickups = state.pickups.filter((p) => p.x > -40 && !p.collected);
    state.landmarks = state.landmarks.filter((l) => l.x > -l.width - 50);
    state.particles = state.particles.filter((p) => p.life > 0);
  }

  // 부의 실제 몸(머리·몸통·다리)에만 충돌 판정이 있다. 말티즈는 어디에 닿아도 게임이 끝나지 않는다.
  function playerBoxes() {
    const feetY = groundAtScreenX(BOO_FOOT_X) + state.playerY + booBob();
    if (state.ducking) return [{ x: 70, y: feetY - 42, w: 104, h: 40 }];
    if (!onGround()) return [{ x: 115, y: feetY - 120, w: 30, h: 118 }];
    return [
      { x: 113, y: feetY - 120, w: 42, h: 37 },
      { x: 120, y: feetY - 83, w: 28, h: 53 },
      { x: 92, y: feetY - 30, w: 66, h: 29 },
    ];
  }

  function handleCollisions() {
    if (state.currentRegion.id === 'space') return;
    const boxes = playerBoxes();
    for (const obstacle of state.obstacles) {
      const box = obstacleBox(obstacle);
      const hit = boxes.find((b) => overlap(b, box));
      if (hit) {
        burst(hit.x + hit.w / 2, hit.y + hit.h / 2, '#ff694e', 14);
        gameOver();
        return;
      }
    }

    for (const pickup of state.pickups) {
      const y = pickupY(pickup);
      const box = { x: pickup.x - 15, y: y - 15, w: 30, h: 30 };
      if (boxes.some((b) => overlap(b, box))) {
        pickup.collected = true;
        state.counts[pickup.food.id] += 1;
        burst(pickup.x, y, pickup.food.color, 7);
      }
    }
  }

  function obstacleBox(obstacle) {
    const groundY = groundAtScreenX(obstacle.x + obstacle.width / 2);
    if (obstacle.kind.type === 'air') return { x: obstacle.x + 3, y: groundY - 122, w: obstacle.width - 6, h: 52 };
    return { x: obstacle.x + 2, y: groundY - 36, w: obstacle.width - 4, h: 36 };
  }

  function overlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function dust(x, amount) {
    const groundY = groundAtScreenX(x);
    for (let i = 0; i < amount; i += 1) {
      state.particles.push({
        x: x + Math.random() * 10 - 5, y: groundY - 4 - Math.random() * 4, color: 'rgba(230,224,210,.85)',
        life: .22 + Math.random() * .18, vx: -60 - Math.random() * 90, vy: -30 - Math.random() * 40, size: 3 + ((Math.random() * 3) | 0),
      });
    }
  }

  function burst(x, y, color, amount) {
    for (let i = 0; i < amount; i += 1) {
      state.particles.push({
        x, y, color, life: .35 + Math.random() * .35,
        vx: -80 + Math.random() * 160,
        vy: -70 - Math.random() * 150,
        size: 3 + ((Math.random() * 5) | 0),
      });
    }
  }

  function rect(x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  function textLabel(text, x, y, size = 12, color = '#18202a', align = 'left', weight = 800) {
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.font = `${weight} ${size}px ui-rounded, "Apple SD Gothic Neo", sans-serif`;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    ctx.fillText(text, Math.round(x), Math.round(y));
    ctx.restore();
  }

  function passingX(speed, phase, span = 720) {
    return W + 90 - ((state.elapsed * speed + phase) % span);
  }

  function drawWalker(x, feetY, shirt, pants, phase = 0, backpack = false, scale = 1) {
    const stride = Math.sin(state.elapsed * 8 + phase) * 3 * scale;
    const s = scale;
    rect(x + 7 * s - stride, feetY - 13 * s, 4 * s, 13 * s, pants);
    rect(x + 13 * s + stride, feetY - 13 * s, 4 * s, 13 * s, pants);
    rect(x + 5 * s, feetY - 31 * s, 14 * s, 19 * s, shirt);
    if (backpack) rect(x + 18 * s, feetY - 29 * s, 5 * s, 14 * s, '#42536a');
    rect(x + 3 * s, feetY - 29 * s + stride * .3, 4 * s, 15 * s, '#efb083');
    rect(x + 18 * s, feetY - 29 * s - stride * .3, 4 * s, 15 * s, '#efb083');
    pxCircle(x + 12 * s, feetY - 39 * s, 7 * s, '#efb083');
    rect(x + 5 * s, feetY - 46 * s, 14 * s, 6 * s, '#27242a');
    rect(x + 4 * s, feetY - 42 * s, 4 * s, 7 * s, '#27242a');
  }

  function drawCyclist(x, feetY) {
    ring(x + 8, feetY - 6, 7, 2, '#26333e'); ring(x + 32, feetY - 6, 7, 2, '#26333e');
    ctx.strokeStyle = '#4c7fab'; ctx.lineWidth = 2; ctx.beginPath();
    ctx.moveTo(x + 8, feetY - 6); ctx.lineTo(x + 19, feetY - 17); ctx.lineTo(x + 32, feetY - 6); ctx.lineTo(x + 15, feetY - 6); ctx.lineTo(x + 22, feetY - 20); ctx.stroke();
    pxCircle(x + 24, feetY - 38, 5, '#efb083'); rect(x + 18, feetY - 32, 11, 14, '#f06e4f');
  }

  function drawCat(x, feetY, color = '#d0a36c') {
    rect(x + 7, feetY - 13, 20, 10, color); pxCircle(x + 7, feetY - 12, 6, color);
    poly([[x + 2, feetY - 17], [x + 5, feetY - 24], [x + 9, feetY - 17]], color);
    rect(x + 11, feetY - 4, 3, 4, shade(color, -28)); rect(x + 23, feetY - 4, 3, 4, shade(color, -28));
    ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x + 27, feetY - 11); ctx.quadraticCurveTo(x + 38, feetY - 22, x + 34, feetY - 29); ctx.stroke();
    rect(x + 4, feetY - 14, 2, 2, '#20252b');
  }

  function drawPaulProfessor(x, feetY) {
    const step = Math.sin(state.elapsed * 6) * 2;
    rect(x + 8 - step, feetY - 10, 4, 10, '#4b5260'); rect(x + 17 + step, feetY - 10, 4, 10, '#4b5260');
    rect(x + 7, feetY - 31, 15, 22, '#72849b'); rect(x + 4, feetY - 28, 4, 17, '#efb083'); rect(x + 22, feetY - 28, 4, 17, '#efb083');
    pxCircle(x + 14, feetY - 39, 7, '#efb083');
    rect(x + 8, feetY - 41, 5, 2, '#273342'); rect(x + 15, feetY - 41, 5, 2, '#273342'); rect(x + 13, feetY - 41, 2, 2, '#273342');
    rect(x + 13, feetY - 35, 2, 5, '#c98262');
    rect(x + 5, feetY - 48, 4, 9, '#f4f3ea'); rect(x + 9, feetY - 54, 4, 14, '#e9e9e2');
    rect(x + 13, feetY - 57, 4, 17, '#ffffff'); rect(x + 17, feetY - 54, 4, 14, '#e9e9e2'); rect(x + 21, feetY - 48, 4, 9, '#f4f3ea');
  }

  function drawTallProfessor(x, feetY) {
    const step = Math.sin(state.elapsed * 5 + 2) * 2;
    rect(x + 8 - step, feetY - 15, 4, 15, '#343b48'); rect(x + 17 + step, feetY - 15, 4, 15, '#343b48');
    rect(x + 10, feetY - 45, 10, 31, '#efece4'); pxCircle(x + 15, feetY - 28, 8, '#efece4');
    rect(x + 13, feetY - 42, 3, 20, '#894642'); rect(x + 6, feetY - 42, 4, 26, '#efb083'); rect(x + 20, feetY - 42, 4, 26, '#efb083');
    pxCircle(x + 15, feetY - 54, 8, '#efb083'); rect(x + 10, feetY - 60, 10, 2, '#c38c69');
  }

  function drawTurtleShip(x, y, scale = 1) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    x = 0; y = 0;
    const bob = Math.sin(state.elapsed * 2.2) * 5;
    poly([[x, y + bob + 12], [x + 12, y + bob], [x + 56, y + bob], [x + 70, y + bob + 12], [x + 58, y + bob + 22], [x + 10, y + bob + 22]], '#6e4c34');
    for (let i = 0; i < 6; i += 1) rect(x + 12 + i * 8, y + bob + 2 + (i % 2) * 3, 7, 8, '#658a78');
    rect(x + 28, y + bob - 19, 3, 20, '#473629'); poly([[x + 31, y + bob - 18], [x + 49, y + bob - 10], [x + 31, y + bob - 4]], '#eee5cf');
    pxCircle(x + 67, y + bob + 8, 5, '#8fa38e'); rect(x - 10, y + bob + 14, 10, 3, '#f3a64b');
    ctx.restore();
  }

  const SCH_BATTLE_AT = [2600, 3520, 4290];

  function currentSchBattle() {
    if (state.currentRegion.id !== 'sch') return null;
    for (const at of SCH_BATTLE_AT) {
      // 거리 1m가 화면 14px이므로 다른 배경 물체와 정확히 같은 속도로 지난다.
      const x = BOO_FOOT_X + (at - state.distance) * 14;
      if (x > -440 && x < W + 440) {
        return { x, at, frame: Math.floor(state.elapsed / .19) % 4 };
      }
    }
    return null;
  }

  function drawGiantTurtleShip(scene) {
    const x = scene.x - 245;
    const y = 306;
    const s = 6.15;
    const pulse = scene.frame % 2 ? 1 : .78;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);

    // 배경에 박힌 추진 화염과 연기. 교수 대련 프레임과 같은 scene.frame을 쓴다.
    for (let i = 0; i < 4; i += 1) {
      const drift = ((state.elapsed * 13 + i * 7) % 20);
      pxCircle(-8 - drift, 17 - i * 5, 5 + i * 1.3, `rgba(66,72,77,${.18 - i * .025})`);
    }
    poly([[-1, 8], [-17 - 9 * pulse, 1], [-10, 12], [-24 - 12 * pulse, 18], [-8, 22], [-18 - 8 * pulse, 31], [2, 26]], '#d7432e');
    poly([[1, 11], [-10 - 6 * pulse, 8], [-5, 16], [-16 - 7 * pulse, 20], [-3, 24], [2, 23]], '#ff9a32');
    poly([[2, 14], [-5 - 4 * pulse, 13], [-1, 19], [-7 - 4 * pulse, 21], [3, 21]], '#ffe36a');

    poly([[0, 15], [9, 3], [58, 3], [75, 14], [62, 29], [10, 29]], '#4b3428');
    poly([[7, 14], [15, 1], [55, 1], [66, 13], [58, 22], [14, 22]], '#78947e');
    for (let i = 0; i < 6; i += 1) {
      const shell = i % 2 ? '#617b69' : '#839d86';
      poly([[14 + i * 7, 7], [18 + i * 7, 3], [23 + i * 7, 8], [20 + i * 7, 15], [14 + i * 7, 14]], shell);
    }
    rect(8, 22, 54, 5, '#2e2420');
    for (let i = 0; i < 5; i += 1) pxCircle(17 + i * 10, 24, 1.8, '#e5a94c');
    // 화면 안쪽에서도 확실히 보이는 하부 추진 화염.
    for (const nozzle of [19, 39, 57]) {
      rect(nozzle - 2, 27, 5, 4, '#30231d');
      poly([[nozzle - 3, 31], [nozzle, 39 + 5 * pulse], [nozzle + 4, 31]], '#e44b2f');
      poly([[nozzle - 1, 31], [nozzle, 36 + 3 * pulse], [nozzle + 2, 31]], '#ffd65b');
    }
    // 용머리와 불빛 나는 눈
    poly([[61, 7], [70, 3], [78, 7], [75, 13], [84, 16], [76, 23], [63, 19]], '#6f8974');
    poly([[76, 9], [82, 5], [80, 12]], '#c49a55');
    pxCircle(76, 11, 1.5, '#ffdf58');
    rect(30, -9, 3, 12, '#42352a');
    poly([[33, -8], [49, -3], [33, 2]], '#e8ddc4');
    ctx.restore();
  }

  function drawProfessorFight(scene) {
    const sprite = sprites.profFight;
    if (!sprite) return;
    const scale = .61;
    const width = sprite.srcW * scale;
    const bottom = groundAtScreenX(scene.x) + 2;
    drawSheetFrame(sprite, scene.frame, scene.x - width / 2, bottom, scale);
    if (scene.frame === 1 || scene.frame === 2) {
      const sparkX = scene.x + (scene.frame === 1 ? 18 : -10);
      textLabel('퍽!', sparkX, bottom - 250, 18, '#ffdc58', 'center', 1000);
    }
  }

  function drawSheetFrame(sprite, frame, x, bottomY, scale) {
    if (!sprite) return;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(sprite.image, frame * sprite.fw, 0, sprite.fw, sprite.fh,
      Math.round(x), Math.round(bottomY - sprite.srcH * scale),
      Math.round(sprite.srcW * scale), Math.round(sprite.srcH * scale));
    ctx.restore();
  }

  function drawSchLandmarkSprite(landmark) {
    const frames = { richVilla: 0, sujiVilla: 1, greenHouseVilla: 2, everTown: 3 };
    if (Object.hasOwn(frames, landmark.type)) {
      const scale = .34;
      drawSheetFrame(sprites.villas, frames[landmark.type], landmark.x - 8, 688, scale);
      signboard(landmark.x + 26, 652, 126, 24, '#294f68', landmark.name, '#fff', 11);
    } else if (landmark.type === 'breakfastBoard') {
      outlined(landmark.x + 44, 574, 104, 82, '#fff8dc', '#315f83', 4);
      textLabel('천원의', landmark.x + 96, 596, 13, '#29465c', 'center', 900);
      textLabel('아침밥', landmark.x + 96, 620, 17, '#df5945', 'center', 900);
      textLabel('든든하게 시작!', landmark.x + 96, 643, 9, '#315f83', 'center', 800);
    }
  }

  function drawProfessorSprite(frame, x, bottomY) {
    // 실제 인물 사진의 인상은 유지하되 게임 안에서는 의도적으로 거인처럼 보이게 한다.
    drawSheetFrame(sprites.professors, frame, x, bottomY, .31);
  }

  function panoramaScreenX(region, sourceX) {
    const image = backgrounds[region.id];
    if (!image) return -999;
    const scale = H / image.naturalHeight;
    const drawWidth = Math.round(image.naturalWidth * scale);
    let x = -Math.floor(state.worldX % drawWidth) + sourceX * scale;
    while (x < -120) x += drawWidth;
    while (x > W + 120) x -= drawWidth;
    return x;
  }

  function smallLocationLabel(text, x, y, color = '#285b83') {
    if (x < -70 || x > W + 70) return;
    const width = Math.max(48, text.length * 9 + 14);
    rect(x - width / 2, y - 10, width, 20, 'rgba(255,255,255,.94)');
    rect(x - width / 2, y - 10, 4, 20, color);
    textLabel(text, x + 2, y, 8, '#26313a', 'center', 900);
  }

  function drawRegionExtras(region) {
    ctx.save();
    if (region.id === 'dongtan') {
      drawWalker(passingX(30, 40), 614, '#4c78b5', '#39475a', 0, true, .9);
      drawWalker(passingX(36, 260), 614, '#f0a74b', '#4c5260', 2, false, .86);
      drawWalker(passingX(27, 480), 614, '#e76578', '#38455d', 4, true, .82);
      drawCyclist(passingX(68, 130, 840), 615);
    } else if (region.id === 'sch') {
      drawWalker(passingX(28, 35), 614, '#4b83bb', '#3c4857', 0, true, .88);
      drawWalker(passingX(32, 260), 614, '#e98268', '#364759', 2, true, .84);
      drawWalker(passingX(25, 510), 614, '#70a56d', '#474452', 4, true, .9);
      drawCat(passingX(15, 90, 620), 615, '#d6a368');
      drawCat(passingX(12, 400, 760), 615, '#8f8b88');
      drawTurtleShip(passingX(42, 70, 760), 190, .86);
      drawTurtleShip(passingX(51, 330, 880), 245, .68);
      drawTurtleShip(passingX(37, 590, 710), 130, .58);
      drawTurtleShip(passingX(58, 810, 960), 310, .48);
    }
    ctx.restore();
  }

  function draw() {
    const region = state.currentRegion || regions[0];
    const schBattle = currentSchBattle();
    computeDaylight();
    const panoramaReady = drawPanorama(region);
    if (!panoramaReady) {
      drawSky(region);
      drawFarLayer(region);
      drawBasicStreet(region);
      for (const landmark of state.landmarks) drawLandmark(landmark, region);
      drawGround(region);
    }
    if (schBattle) drawGiantTurtleShip(schBattle);
    if (region.id !== 'space') drawRunningRoute(region);
    if (panoramaReady && region.id === 'sch') {
      for (const landmark of state.landmarks) drawSchLandmarkSprite(landmark);
    }
    drawRegionExtras(region);
    if (schBattle) drawProfessorFight(schBattle);
    drawSpeedLines(region);
    for (const pickup of state.pickups) drawFood(pickup);
    for (const obstacle of state.obstacles) drawObstacle(obstacle);
    drawCharacters();
    drawParticles();
    drawDayTint();
    drawHud(region);
    if (state.mode === 'menu') drawMenuBackdrop();
  }

  // ==== 배경: 픽셀 도시 거리 (참조 그림체) ====
  // 평평한 파란 하늘, 흰 픽셀 구름, 연한 회색 스카이라인, 간판 달린 상가와 회색 사무 빌딩,
  // 가로수·가로등·신호등이 서 있는 회색 보도, 흰 점선과 건널목이 있는 검은 아스팔트.
  const BASE = 590;                 // 보도 윗선 = 건물 바닥
  const OUTLINE = '#3b4350';
  const SLOT = 150;

  function drawPanorama(region) {
    const image = backgrounds[region.id];
    if (!image) return false;
    const drawHeight = H;
    const drawWidth = Math.round(image.naturalWidth * drawHeight / image.naturalHeight);
    // 파노라마 한 장에 4~5개의 서로 다른 거리 구간이 들어 있다. 전체가 약 4~5초마다
    // 한 바퀴 돌아 기본 거리의 반복감은 유지하면서도 풍경 변화가 계속 보인다.
    // 우주는 지상 풍경보다 훨씬 느린 원경으로 흘러간다. 한 이미지가 다시
    // 돌아오는 시간을 늘려 반복 패턴을 알아차리기 어렵게 만든다.
    const panoramaX = region.id === 'space' ? state.worldX * .18 : state.worldX;
    const offset = -Math.floor(panoramaX % drawWidth);
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    for (let x = offset - drawWidth; x < W + drawWidth; x += drawWidth) {
      if (region.id === 'space' && Math.round((x - offset) / drawWidth) % 2 !== 0) {
        // Every second tile is mirrored. Adjacent outer edges are therefore
        // identical, eliminating the visible hard seam in an endless world.
        ctx.save();
        ctx.translate(x + drawWidth, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(image, 0, 0, drawWidth, drawHeight);
        ctx.restore();
      } else {
        ctx.drawImage(image, x, 0, drawWidth, drawHeight);
      }
    }
    ctx.restore();
    return true;
  }

  function hash(n) {
    let t = Math.imul(n | 0, 2654435761) >>> 0;
    t ^= t >>> 13; t = Math.imul(t, 1597334677) >>> 0; t ^= t >>> 16;
    return (t >>> 8) / 16777216;
  }

  function outlined(x, y, w, h, fill, line = OUTLINE, t = 2) {
    rect(x, y, w, h, line);
    rect(x + t, y + t, w - 2 * t, h - 2 * t, fill);
  }

  function glass(x, y, w, h, color = '#5fb0e0') {
    const lit = daylight.glow > .05 && hash((Math.round(x) * 31 + Math.round(y) * 17) | 0) < .62;
    if (lit) {
      const c = lerpArr([95, 176, 224], [255, 214, 110], daylight.glow);
      outlined(x, y, w, h, rgb(c), '#3d4a5a', 2);
      rect(x + 3, y + 3, 3, Math.max(2, h - 6), rgb(lerpArr([179, 226, 247], [255, 240, 190], daylight.glow)));
      return;
    }
    outlined(x, y, w, h, color, '#3d5a73', 2);
    rect(x + 3, y + 3, 3, Math.max(2, h - 6), '#b3e2f7');
  }

  // 랜드마크 코드가 쓰는 기존 시그니처 유지 (17·22px 간격 격자)
  function windows(x, y, cols, rows, color = '#5fb0e0') {
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) glass(x + col * 17, y + row * 22, 12, 14, color);
    }
  }

  function taegeuk(cx, cy, r) {
    ctx.fillStyle = '#e0453c'; ctx.beginPath(); ctx.arc(cx, cy, r, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#2f5fb3'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI); ctx.fill();
    ctx.fillStyle = '#e0453c'; ctx.beginPath(); ctx.arc(cx - r / 2, cy, r / 2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2f5fb3'; ctx.beginPath(); ctx.arc(cx + r / 2, cy, r / 2, 0, Math.PI * 2); ctx.fill();
  }

  function cloud(x, y, s = 1, color = '#ffffff') {
    rect(x + 8 * s, y, 26 * s, 12 * s, color);
    rect(x, y + 6 * s, 46 * s, 10 * s, color);
    rect(x + 22 * s, y + 3 * s, 18 * s, 9 * s, color);
    rect(x + 2 * s, y + 14 * s, 42 * s, 3 * s, shade(color, -30));
  }

  function tree(x, y, leaf = '#3f8f45', trunk = '#6b4a32') {
    const dark = shade(leaf, -42);
    rect(x + 13, y + 40, 8, 36, trunk); rect(x + 13, y + 40, 2, 36, shade(trunk, -30));
    rect(x + 4, y + 10, 26, 34, dark); rect(x, y + 18, 34, 20, dark); rect(x + 9, y + 2, 16, 12, dark);
    rect(x + 6, y + 12, 22, 30, leaf); rect(x + 2, y + 20, 30, 16, leaf); rect(x + 11, y + 4, 12, 10, leaf);
    rect(x + 9, y + 14, 8, 6, shade(leaf, 38)); rect(x + 6, y + 25, 5, 5, shade(leaf, 38)); rect(x + 20, y + 20, 5, 4, shade(leaf, 38));
  }

  function lamp(x, baseY) {
    rect(x, baseY - 96, 4, 96, OUTLINE);
    rect(x - 7, baseY - 102, 18, 7, OUTLINE);
    rect(x - 5, baseY - 100, 14, 3, '#fff3b0');
    rect(x - 4, baseY - 5, 12, 5, OUTLINE);
  }

  function trafficLight(x, baseY) {
    rect(x, baseY - 92, 4, 92, '#2f353d');
    outlined(x - 6, baseY - 122, 16, 36, '#2f353d', '#1c2027');
    rect(x - 2, baseY - 118, 8, 8, '#e8473c');
    rect(x - 2, baseY - 108, 8, 8, '#f2c531');
    rect(x - 2, baseY - 98, 8, 8, '#4bc45c');
    rect(x - 4, baseY - 4, 12, 4, '#2f353d');
  }

  function awning(x, y, w, a, b) {
    for (let i = 0; i < w; i += 8) rect(x + i, y, Math.min(8, w - i), 10, ((i / 8) | 0) % 2 ? a : b);
    rect(x, y + 10, w, 2, shade(a, -45));
  }

  function signboard(x, y, w, h, bg, text, color = '#fff', size = 10) {
    outlined(x, y, w, h, bg);
    textLabel(text, x + w / 2, y + h / 2, size, color, 'center', 900);
  }

  function roofSign(x, y, w, text, bg = '#2f5fb3') {
    rect(x + 8, y + 22, 4, 12, OUTLINE); rect(x + w - 12, y + 22, 4, 12, OUTLINE);
    signboard(x, y, w, 24, bg, text, '#fff', 10);
  }

  function officeBlock(x, w, h, wall, opts = {}) {
    const y = BASE - h;
    outlined(x, y, w, h, wall);
    rect(x, y, w, 8, shade(wall, -48));
    const cw = 12, ch = 14, gx = 8, gy = 12;
    const cols = Math.max(1, Math.floor((w - 20) / (cw + gx)));
    const startX = x + Math.round((w - (cols * (cw + gx) - gx)) / 2);
    for (let wy = y + 20; wy < BASE - 56; wy += ch + gy) {
      for (let c = 0; c < cols; c += 1) glass(startX + c * (cw + gx), wy, cw, ch, opts.win || '#5fb0e0');
    }
    rect(x + 2, BASE - 46, w - 4, 44, shade(wall, -16));
    glass(x + w / 2 - 17, BASE - 42, 34, 42, '#7cc4ea');
    rect(x + w / 2 - 1, BASE - 42, 2, 42, '#3d5a73');
    if (opts.roofSign) roofSign(x + w / 2 - 44, y - 34, 88, opts.roofSign, opts.roofColor);
    if (opts.wallSign) signboard(x + 12, y + 14, w - 24, 22, opts.wallSign[1], opts.wallSign[0], '#fff', 10);
  }

  function brickTexture(x, y, w, h, color) {
    const line = shade(color, -28);
    for (let by = y + 6; by < y + h - 4; by += 12) {
      for (let bx = x + ((((by - y) / 12) | 0) % 2 ? 0 : 9); bx < x + w - 6; bx += 20) rect(bx, by, 14, 4, line);
    }
  }

  function shopFront(x, w, h, wall, sign, label, stripes, door = '#6b4a32', brick = false) {
    const y = BASE - h;
    outlined(x, y, w, h, wall);
    if (brick) brickTexture(x + 2, y + 2, w - 4, h - 90, wall);
    rect(x, y, w, 6, shade(wall, -44));
    const n = Math.max(1, Math.floor((w - 24) / 34));
    const wx0 = x + Math.round((w - (n * 34 - 14)) / 2);
    for (let i = 0; i < n; i += 1) glass(wx0 + i * 34, y + 20, 20, 24);
    signboard(x + 6, BASE - 90, w - 12, 26, sign, label, '#fff', 12);
    if (stripes) awning(x + 6, BASE - 62, w - 12, stripes[0], stripes[1]);
    glass(x + 8, BASE - 48, w - 46, 48, '#8fd0f0');
    outlined(x + w - 34, BASE - 48, 26, 48, door);
    rect(x + w - 15, BASE - 26, 3, 3, '#f2c531');
    rect(x + 12, BASE - 10, 12, 10, '#6b4a32'); rect(x + 10, BASE - 20, 16, 10, '#3f8f45');
  }

  function glassTower(x, w, h, wall) {
    const y = BASE - h;
    outlined(x, y, w, h, wall);
    rect(x, y, w, 6, shade(wall, -40));
    for (let wy = y + 14; wy < BASE - 50; wy += 24) {
      for (let wx = x + 8; wx < x + w - 14; wx += 16) glass(wx, wy, 12, 16, '#6ab9e6');
    }
    rect(x + 2, BASE - 46, w - 4, 44, shade(wall, -12));
    glass(x + w / 2 - 20, BASE - 42, 40, 42, '#7cc4ea');
  }

  function warehouse(x, w, h, wall, label) {
    const y = BASE - h;
    outlined(x, y, w, h, wall);
    brickTexture(x + 2, y + 2, w - 4, h - 4, wall);
    rect(x, y, w, 8, shade(wall, -40));
    for (let wx = x + 12; wx < x + w - 30; wx += 40) outlined(wx, y + 26, 28, 34, '#2e3a44', '#1e262d');
    rect(x + 6, BASE - 70, w - 12, 70, '#2a2f34');
    textLabel(label, x + w / 2, BASE - 56, 12, '#f3e7d1', 'center', 900);
    glass(x + w / 2 - 22, BASE - 42, 44, 42, '#4f6d80');
  }

  function campusHall(x, w, h, wall, band, label) {
    const y = BASE - h;
    outlined(x, y, w, h, wall);
    rect(x, y, w, 14, band);
    textLabel(label, x + w / 2, y + 7, 9, '#fff', 'center', 900);
    for (let wy = y + 26; wy < BASE - 60; wy += 28) {
      for (let wx = x + 12; wx < x + w - 18; wx += 24) glass(wx, wy, 14, 16, '#6fb9e2');
    }
    rect(x + w / 2 - 24, BASE - 48, 48, 48, shade(wall, -30));
    glass(x + w / 2 - 18, BASE - 42, 36, 42, '#7cc4ea');
  }

  const STREETS = {
    osanStreet: [
      (x, w, r) => officeBlock(x, w, 220 + r * 70, '#d9dde2'),
      (x, w) => shopFront(x, w, 150, '#e6d3a8', '#6b4a32', '카페 ☕', ['#3f8f45', '#f4f4f4']),
      (x, w) => shopFront(x, w, 170, '#b8714f', '#a8352d', '부동산', null, '#3d5a73', true),
      (x, w) => shopFront(x, w, 150, '#e0e4e8', '#2f9a4a', '편의점', ['#2f9a4a', '#f4f4f4']),
      (x, w) => shopFront(x, w, 160, '#e6d3a8', '#d9a53a', '문구점', ['#f2c531', '#f4f4f4']),
      (x, w, r) => officeBlock(x, w, 250 + r * 40, '#e4e7eb', { roofSign: '테크타워' }),
      (x, w) => shopFront(x, w, 160, '#d9dde2', '#e0453c', '치킨', ['#e0453c', '#f4f4f4']),
    ],
    newTown: [
      (x, w, r) => glassTower(x, w, 290 + r * 60, '#cfd8e0'),
      (x, w, r) => officeBlock(x, w, 250 + r * 70, '#e4e7eb', { win: '#6ab9e6' }),
      (x, w, r) => glassTower(x, w, 330 + r * 30, '#c4d0dc'),
      (x, w) => shopFront(x, w, 160, '#e0e4e8', '#2f9a4a', '약국 ✚', null, '#3d5a73'),
      (x, w) => shopFront(x, w, 170, '#d9dde2', '#2f5fb3', '은행', null, '#3d5a73'),
      (x, w, r) => glassTower(x, w, 300 + r * 40, '#d6dde4'),
    ],
    campus: [
      (x, w, r) => campusHall(x, w, 180 + r * 60, '#eee6d3', '#2f6b92', '순천향대'),
      (x, w) => { tree(x + 6, BASE - 78, '#3f8f45'); tree(x + 44, BASE - 90, '#4fa653'); tree(x + 84, BASE - 76, '#3a8542'); },
      (x, w) => shopFront(x, w, 150, '#e0e4e8', '#e8783c', '분식', ['#e8783c', '#f4f4f4']),
      (x, w) => { outlined(x, BASE - 60, w, 60, '#7fa86a'); for (let i = 0; i < w - 8; i += 12) rect(x + 4 + i, BASE - 58, 2, 56, '#5c7d4c'); textLabel('대운동장', x + w / 2, BASE - 68, 9, '#2f6b92', 'center', 900); },
      (x, w, r) => campusHall(x, w, 200 + r * 40, '#e4e7eb', '#3c7396', '강의동'),
      (x, w) => shopFront(x, w, 150, '#e6d3a8', '#2f3a4e', '서점', null, '#3d5a73'),
    ],
    gwangjin: [
      (x, w) => shopFront(x, w, 160, '#b8714f', '#2f5fb3', '세탁소', null, '#3d5a73', true),
      (x, w) => shopFront(x, w, 150, '#e6d3a8', '#6b4a32', '카페 ☕', ['#3f8f45', '#f4f4f4']),
      (x, w) => shopFront(x, w, 160, '#e0e4e8', '#e0453c', '슈퍼', ['#e0453c', '#f4f4f4']),
      (x, w, r) => officeBlock(x, w, 190 + r * 50, '#d9dde2'),
      (x, w) => shopFront(x, w, 150, '#f0d6dc', '#d9538a', '미용실', null, '#3d5a73'),
      (x, w) => shopFront(x, w, 170, '#b8714f', '#3f8f45', '군자동 골목', null, '#3d5a73', true),
    ],
    seongsu: [
      (x, w, r) => warehouse(x, w, 190 + r * 50, '#9d624b', '인쇄'),
      (x, w) => warehouse(x, w, 170, '#b47a5a', '수제화'),
      (x, w) => shopFront(x, w, 160, '#817773', '#1f1f1f', 'POP-UP', null, '#2a2f34'),
      (x, w, r) => officeBlock(x, w, 200 + r * 40, '#a8a3a0', { win: '#7d9aa8' }),
      (x, w) => warehouse(x, w, 180, '#8b5847', '연무장길'),
      (x, w) => shopFront(x, w, 150, '#e6d3a8', '#6b4a32', '카페 ☕', ['#6b4a32', '#f4f4f4']),
    ],
  };

  // ---- 하루의 흐름: 새벽 → 오전 → 오후 → 저녁, 각 60초씩 4분 주기로 천천히 반복 ----
  const DAY_PHASES = [
    { name: '새벽', top: [62, 66, 118], bottom: [242, 168, 128], tint: [70, 50, 110, .22], cloud: [238, 200, 205], glow: 1, sun: [70, 470], star: .7 },
    { name: '오전', top: [124, 196, 240], bottom: [204, 234, 251], tint: [0, 0, 0, 0], cloud: [255, 255, 255], glow: 0, sun: [160, 190], star: 0 },
    { name: '오후', top: [92, 176, 234], bottom: [170, 220, 246], tint: [255, 214, 140, .07], cloud: [255, 250, 240], glow: 0, sun: [290, 130], star: 0 },
    { name: '저녁', top: [40, 42, 92], bottom: [244, 126, 78], tint: [60, 40, 95, .30], cloud: [250, 172, 150], glow: 1, sun: [330, 440], star: .8 },
  ];
  const DAY_PHASE_SECONDS = 60;
  const DAY_BLEND_SECONDS = 14;
  const lerp = (a, b, t) => a + (b - a) * t;
  const lerpArr = (a, b, t) => a.map((v, i) => lerp(v, b[i], t));
  const rgb = (c) => `rgb(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])})`;
  const rgba = (c) => `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${c[3].toFixed(3)})`;
  let daylight = DAY_PHASES[1];

  function computeDaylight() {
    const t = state.elapsed % (DAY_PHASE_SECONDS * DAY_PHASES.length);
    const i = Math.floor(t / DAY_PHASE_SECONDS);
    const f = Math.min(1, (t % DAY_PHASE_SECONDS) / DAY_BLEND_SECONDS);
    const k = f * f * (3 - 2 * f);
    const a = DAY_PHASES[(i + DAY_PHASES.length - 1) % DAY_PHASES.length];
    const b = DAY_PHASES[i];
    daylight = {
      name: k < .5 ? a.name : b.name,
      top: lerpArr(a.top, b.top, k), bottom: lerpArr(a.bottom, b.bottom, k), tint: lerpArr(a.tint, b.tint, k),
      cloud: lerpArr(a.cloud, b.cloud, k), glow: lerp(a.glow, b.glow, k), sun: lerpArr(a.sun, b.sun, k), star: lerp(a.star, b.star, k),
    };
  }

  function drawSun() {
    const [sx, sy] = daylight.sun;
    const warm = daylight.glow;
    const core = rgb(lerpArr([255, 244, 190], [255, 150, 90], warm));
    const halo = rgb(lerpArr([255, 250, 220], [255, 190, 130], warm));
    rect(sx - 26, sy - 10, 52, 20, halo); rect(sx - 10, sy - 26, 20, 52, halo);
    rect(sx - 18, sy - 18, 36, 36, halo);
    rect(sx - 14, sy - 14, 28, 28, core); rect(sx - 20, sy - 8, 40, 16, core); rect(sx - 8, sy - 20, 16, 40, core);
  }

  function drawStars(alpha) {
    if (alpha <= 0) return;
    ctx.save(); ctx.globalAlpha = alpha;
    for (let i = 0; i < 40; i += 1) {
      const x = (i * 97 + 23) % W;
      const y = (i * 53 + 11) % 330;
      const tw = ((i + Math.floor(state.elapsed * 1.5)) % 7 === 0) ? 3 : 2;
      rect(x, y, tw, tw, i % 3 ? '#fff6d8' : '#cfe8ff');
    }
    ctx.restore();
  }

  function drawDayTint() {
    if (state.currentRegion.id === 'space' || daylight.tint[3] <= 0) return;
    rect(0, 0, W, H, rgba(daylight.tint));
  }

  function drawSky(region) {
    if (region.id !== 'space') {
      const bands = 14;
      for (let i = 0; i < bands; i += 1) {
        const t = i / (bands - 1);
        rect(0, Math.round(i * (BASE / bands)), W, Math.ceil(BASE / bands) + 1, rgb(lerpArr(daylight.top, daylight.bottom, t)));
      }
      rect(0, BASE, W, H - BASE, rgb(daylight.bottom));
      drawStars(daylight.star);
      drawSun();
    } else {
      rect(0, 0, W, H, region.sky);
    }
    if (region.id === 'space') {
      for (let i = 0; i < 46; i += 1) {
        const x = (i * 83 + 17) % W;
        const y = (i * 47 + 53) % 520;
        const blink = ((i + Math.floor(state.elapsed * 2)) % 5 === 0) ? 3 : 2;
        rect(x, y, blink, blink, i % 4 ? '#f6f0ca' : '#94ddff');
      }
      return;
    }
    const span = 210;
    const off = -(state.worldX * .08) % span;
    for (let i = -1; i < W / span + 2; i += 1) {
      const idx = Math.round((i * span - off) / span);
      const x = off + i * span + hash(idx * 3) * 70;
      const y = 50 + hash(idx * 5) * 250;
      cloud(x, y, 1.1 + hash(idx * 7) * 1.1, rgb(daylight.cloud));
    }
  }

  function drawSpeedLines(region) {
    if (state.mode !== 'playing' || state.paused) return;
    // 우주는 빠르게 달리는 공간이 아니라 조용히 유영하는 공간이다.
    if (region.id === 'space') return;
    const intensity = Math.max(0, Math.min(1, (state.speed - MIN_SPEED) / (MAX_SPEED - MIN_SPEED)));
    const count = 3 + Math.floor(intensity * 6);
    ctx.save();
    ctx.globalAlpha = .18 + intensity * .2;
    ctx.fillStyle = region.id === 'space' ? '#c5efff' : '#ffffff';
    for (let i = 0; i < count; i += 1) {
      const span = 480 + i * 17;
      const x = ((i * 113 - state.worldX * (.48 + i * .018)) % span + span) % span - 90;
      const y = 176 + ((i * 79) % 360);
      const length = 20 + intensity * 54 + (i % 3) * 11;
      ctx.fillRect(Math.round(x), y, Math.round(length), intensity > .55 ? 3 : 2);
    }
    ctx.restore();
  }

  function farTower(x, w, h, far, win) {
    rect(x, BASE - h, w, h, far);
    rect(x, BASE - h, w, 5, shade(far, -18));
    for (let wy = BASE - h + 14; wy < BASE - 30; wy += 16) {
      for (let wx = x + 8; wx < x + w - 8; wx += 12) rect(wx, wy, 6, 8, win);
    }
  }

  function hill(x, w, h, color) {
    ctx.fillStyle = color; ctx.beginPath();
    ctx.moveTo(x, BASE); ctx.lineTo(x + w * .3, BASE - h * .8); ctx.lineTo(x + w * .5, BASE - h); ctx.lineTo(x + w * .72, BASE - h * .7); ctx.lineTo(x + w, BASE); ctx.fill();
  }

  // 지역마다 다른 원경: 오산 낮은 언덕과 중층 건물 / 동탄 빽빽한 고층 타워 / 신창 산과 캠퍼스 숲 /
  // 광진 아차산과 멀리 롯데월드타워 / 성수 응봉산·한강 다리·남산타워
  function drawFarLayer(region) {
    if (region.id === 'space') {
      rect(252, 248, 90, 90, '#366da1'); rect(268, 254, 58, 73, '#4c9cc2'); rect(289, 268, 19, 14, '#6ca865');
      return;
    }
    const far = region.far;
    const win = shade(far, 34);
    const par = .22;
    const slot = 72;
    const off = -(state.worldX * par) % slot;
    if (region.id !== 'dongtan') {
      const mslot = 260;
      const moff = -(state.worldX * .08) % mslot;
      const mcolor = shade(far, region.id === 'sch' ? -6 : 8);
      for (let x = moff - mslot; x < W + mslot; x += mslot) {
        const idx = Math.round((x + state.worldX * .08) / mslot);
        hill(x, mslot + 40, (region.id === 'sch' ? 250 : 130) + hash(idx * 29) * 80, mcolor);
      }
      if (region.id === 'gwangjin') {
        const tx = ((-(state.worldX * .08) % 1400) + 1400) % 1400 - 300;
        ctx.fillStyle = shade(far, -4); ctx.beginPath(); ctx.moveTo(tx, BASE); ctx.lineTo(tx + 6, BASE - 330); ctx.lineTo(tx + 10, BASE - 360); ctx.lineTo(tx + 14, BASE - 330); ctx.lineTo(tx + 20, BASE); ctx.fill();
      }
      if (region.id === 'seongsu') {
        const tx = ((-(state.worldX * .08) % 1300) + 1300) % 1300 - 200;
        rect(tx + 6, BASE - 240, 4, 240, shade(far, -4)); rect(tx - 2, BASE - 200, 20, 16, shade(far, -4)); rect(tx + 7, BASE - 290, 2, 50, shade(far, -4));
      }
    }
    for (let x = off - slot; x < W + slot; x += slot) {
      const idx = Math.round((x + state.worldX * par) / slot);
      const r = hash(idx * 11);
      if (region.id === 'dongtan') {
        farTower(x, 56 + hash(idx * 19) * 14, 220 + r * 140, far, win);
      } else if (region.id === 'sch') {
        if (hash(idx * 13) < .7) { tree(x + 10, BASE - 70 - hash(idx * 7) * 30, shade(far, -30), shade(far, -60)); tree(x + 42, BASE - 60, shade(far, -22), shade(far, -60)); }
        else farTower(x + 6, 50, 90 + r * 50, far, win);
      } else if (region.id === 'gwangjin') {
        if (hash(idx * 13) < .45) { tree(x + 8, BASE - 74, shade(far, -26), shade(far, -60)); tree(x + 40, BASE - 66, shade(far, -18), shade(far, -60)); }
        else farTower(x, 54, 120 + r * 120, far, win);
      } else if (region.id === 'seongsu') {
        if (hash(idx * 13) < .35) {
          rect(x - 4, BASE - 96, slot + 8, 8, shade(far, -10)); rect(x + 10, BASE - 88, 6, 88, shade(far, -10)); rect(x + 50, BASE - 88, 6, 88, shade(far, -10));
          for (let i = 0; i < 4; i += 1) rect(x + 4 + i * 18, BASE - 110 + (i % 2) * 6, 3, 14 - (i % 2) * 6, shade(far, -10));
        } else farTower(x, 54, 110 + r * 150, far, win);
      } else {
        farTower(x, 52 + hash(idx * 19) * 16, 110 + r * 150, far, win);
      }
    }
  }

  function drawBasicStreet(region) {
    if (region.id === 'space') {
      const off = -state.worldX % 132;
      for (let x = off - 132; x < W + 132; x += 132) drawSpaceTile(x, region);
      return;
    }
    const modules = STREETS[region.tile] || STREETS.osanStreet;
    const off = -state.worldX % SLOT;
    const furniture = [];
    for (let x = off - SLOT; x < W + SLOT; x += SLOT) {
      const idx = Math.round((x + state.worldX) / SLOT);
      const pick = Math.floor(hash(idx * 7 + 1) * modules.length);
      const w = 116 + Math.floor(hash(idx * 11 + 2) * 22);
      const blocked = state.landmarks.some((lm) => x + w + 10 > lm.x - 6 && x - 8 < lm.x + lm.width + 6);
      if (blocked) continue;
      modules[pick](x + 2, w, hash(idx * 13 + 3));
      const f = hash(idx * 17 + 4);
      const fx = x + w + 14;
      if (f < .5) furniture.push(() => tree(fx - 12, BASE - 78, f < .25 ? '#3f8f45' : '#4fa653'));
      else if (f < .72) furniture.push(() => lamp(fx, BASE));
      else if (f < .84) furniture.push(() => trafficLight(fx, BASE));
      if (idx % 4 === 1) furniture.push(() => streetSign(region, x + 40, BASE - 118, idx % 3));
    }
    for (const draw of furniture) draw();
  }

  function streetSign(region, x, y, index = 0) {
    rect(x + 28, y + 18, 4, 100, OUTLINE);
    signboard(x, y, 60, 20, region.accent, region.signs[index % region.signs.length], '#fff', 8);
  }

  function drawSpaceTile(x) {
    rect(x + 10, BASE - 42, 32, 18, '#7d7395');
    rect(x + 83, BASE - 64, 46, 27, '#645a7a');
    rect(x + 48, BASE - 95, 13, 13, '#9e92b2');
    if ((((x + state.worldX) / 132) | 0) % 3 === 0) streetSign(state.currentRegion, x + 35, BASE - 145, 1);
  }

  function drawGround(region) {
    // 보도 (타일 격자)
    rect(0, BASE, W, 40, region.sidewalk);
    rect(0, BASE, W, 3, shade(region.sidewalk, 26));
    const tileOff = -state.worldX % 24;
    for (let x = tileOff - 24; x < W + 24; x += 24) rect(x, BASE + 3, 2, 37, shade(region.sidewalk, -18));
    rect(0, BASE + 21, W, 2, shade(region.sidewalk, -18));
    rect(0, BASE + 36, W, 4, shade(region.sidewalk, -34));
    // 도로: 캐릭터가 달리는 무대. 어두운 아스팔트라 흰 옷과 흰 강아지가 또렷하게 보인다.
    rect(0, BASE + 40, W, H - BASE - 40, region.ground);
    rect(0, BASE + 40, W, 3, shade(region.ground, 30));
    const dashOff = -state.worldX % 72;
    for (let x = dashOff - 72; x < W + 72; x += 72) rect(x, BASE + 62, 36, 5, '#e9e9e9');
    const cw = 1100;
    const cOff = -state.worldX % cw;
    for (let x = cOff - cw; x < W + cw; x += cw) {
      for (let i = 0; i < 6; i += 1) rect(x + 300 + i * 14, BASE + 74, 8, H - BASE - 96, 'rgba(240,240,240,.85)');
    }
    rect(0, H - 14, W, 14, region.sidewalk);
    rect(0, H - 14, W, 3, shade(region.sidewalk, -34));
  }

  // 배경에 그려진 언덕이 아니라 캐릭터가 실제로 밟는 전경의 길이다.
  // 화면의 모든 x에서 같은 함수를 사용하므로 발, 장애물, 음식과 그림자가
  // 정확히 같은 경사선 위에 놓인다.
  function drawRunningRoute(region) {
    const palette = {
      osan: { fill: '#aaa49a', edge: '#706b64', seam: '#8d887f', mark: '#d7d1c4' },
      dongtan: { fill: '#c5c9ca', edge: '#7f878b', seam: '#a8adaf', mark: '#eef0ed' },
      sch: { fill: '#b7ae9d', edge: '#6f685e', seam: '#958c7c', mark: '#d7c99f' },
      gwangjin: { fill: '#b9aa8c', edge: '#756a55', seam: '#98896d', mark: '#d9cbaa' },
    }[region.id];
    if (!palette) return;
    const step = 8;
    const trace = (offset = 0) => {
      ctx.beginPath();
      for (let x = -step; x <= W + step; x += step) {
        const y = groundAtScreenX(x) + offset;
        if (x === -step) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
    };

    trace();
    ctx.lineTo(W + step, H); ctx.lineTo(-step, H); ctx.closePath();
    ctx.fillStyle = palette.fill; ctx.fill();
    trace(); ctx.strokeStyle = palette.edge; ctx.lineWidth = 6; ctx.stroke();
    trace(5); ctx.strokeStyle = palette.mark; ctx.lineWidth = 2; ctx.stroke();
    trace(32); ctx.strokeStyle = palette.seam; ctx.lineWidth = 1; ctx.globalAlpha = .55; ctx.stroke();
    trace(66); ctx.stroke();

    const tileOffset = -(state.worldX * .55) % 54;
    ctx.strokeStyle = palette.seam;
    ctx.lineWidth = 1;
    ctx.globalAlpha = .42;
    for (let x = tileOffset - 54; x < W + 54; x += 54) {
      const y = groundAtScreenX(x);
      ctx.beginPath(); ctx.moveTo(x, y + 5); ctx.lineTo(x - 8, H); ctx.stroke();
    }
    if (region.id === 'osan') {
      // 2000년대 초반 오래된 보도처럼 작은 균열과 덧댄 흔적.
      const crackOffset = -(state.worldX * .8) % 126;
      ctx.strokeStyle = '#777169'; ctx.globalAlpha = .48;
      for (let x = crackOffset - 126; x < W + 126; x += 126) {
        const y = groundAtScreenX(x) + 18;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 7, y + 6); ctx.lineTo(x + 3, y + 13); ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  // 발밑 그림자: 캐릭터·장애물이 바닥에 붙어 보이게 한다
  function groundShadow(cx, w, height = 0) {
    const k = Math.max(.35, 1 - height / 320);
    ctx.save();
    ctx.fillStyle = 'rgba(20, 24, 32, .28)';
    ctx.beginPath();
    ctx.ellipse(Math.round(cx), Math.round(groundAtScreenX(cx) - 2), Math.round(w * k / 2), Math.round(5 * k) + 1, groundAngleAtScreenX(cx), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function shade(color, amount) {
    let r, g, b;
    if (color.startsWith('#')) {
      const number = parseInt(color.slice(1), 16);
      r = number >> 16; g = (number >> 8) & 255; b = number & 255;
    } else {
      [r, g, b] = color.match(/\d+/g).map(Number);
    }
    const c = (v) => Math.max(0, Math.min(255, v + amount));
    return `rgb(${c(r)},${c(g)},${c(b)})`;
  }

  // ==== 랜드마크: 지명마다 유명한 장소를 픽셀아트로 ====
  function pxCircle(cx, cy, r, color) { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(Math.round(cx), Math.round(cy), r, 0, Math.PI * 2); ctx.fill(); }
  function ring(cx, cy, r, width, color) { ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath(); ctx.arc(Math.round(cx), Math.round(cy), r, 0, Math.PI * 2); ctx.stroke(); }
  function dome(cx, baseY, r, color) { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(Math.round(cx), Math.round(baseY), r, Math.PI, 0); ctx.fill(); }
  function poly(points, color) { ctx.fillStyle = color; ctx.beginPath(); points.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); ctx.closePath(); ctx.fill(); }
  function rails(x, y, w) {
    rect(x, y, w, 3, '#6d6d6d'); rect(x, y + 8, w, 3, '#6d6d6d');
    for (let i = 0; i < w; i += 14) rect(x + i, y - 1, 8, 12, '#8b6b4a');
    rect(x, y, w, 3, '#6d6d6d'); rect(x, y + 8, w, 3, '#6d6d6d');
  }
  function train(x, y, w, body, stripe, label) {
    outlined(x, y - 44, w, 44, body);
    rect(x + 2, y - 20, w - 4, 6, stripe);
    for (let wx = x + 10; wx < x + w - 16; wx += 24) glass(wx, y - 38, 16, 14, '#8fd0f0');
    rect(x + 6, y - 6, 12, 8, '#2f353d'); rect(x + w - 18, y - 6, 12, 8, '#2f353d');
    poly([[x + w, y - 44], [x + w + 14, y - 30], [x + w + 14, y - 4], [x + w, y]], body);
    if (label) textLabel(label, x + w / 2, y - 12, 8, '#fff', 'center', 900);
  }
  function hanokRoof(x, y, w, h, color) {
    poly([[x - 12, y + h], [x + 10, y + 8], [x + w / 2, y], [x + w - 10, y + 8], [x + w + 12, y + h]], color);
    rect(x - 14, y + h - 4, w + 28, 6, shade(color, -30));
    for (let i = x + 4; i < x + w - 4; i += 10) rect(i, y + h - 12, 4, 8, shade(color, 25));
  }
  function jets(x, y, count, h, color = '#dff6ff') {
    ctx.strokeStyle = color; ctx.lineWidth = 3;
    for (let i = 0; i < count; i += 1) {
      const wob = Math.sin(state.elapsed * 3 + i) * 6;
      ctx.beginPath(); ctx.moveTo(x + i * 26, y); ctx.quadraticCurveTo(x + 12 + i * 26, y - h - wob - (i % 2) * 18, x + 22 + i * 26, y); ctx.stroke();
    }
  }
  function water(x, y, w, h, color = '#68a8c0') {
    rect(x, y, w, h, color);
    for (let i = 0; i < w; i += 30) rect(x + i + ((Math.floor(state.elapsed * 3) + i) % 12), y + 6 + (i % 3) * 8, 14, 2, shade(color, 40));
  }
  function deer(x, y) {
    rect(x + 6, y - 22, 26, 14, '#9a6b3f'); rect(x + 28, y - 34, 10, 16, '#9a6b3f'); rect(x + 32, y - 38, 8, 8, '#9a6b3f');
    rect(x + 8, y - 8, 3, 8, '#7a5230'); rect(x + 26, y - 8, 3, 8, '#7a5230'); rect(x + 14, y - 8, 3, 8, '#7a5230');
    rect(x + 34, y - 44, 2, 8, '#5b3d22'); rect(x + 38, y - 44, 2, 8, '#5b3d22'); rect(x + 30, y - 46, 12, 2, '#5b3d22');
    rect(x + 12, y - 20, 3, 3, '#fff'); rect(x + 20, y - 16, 3, 3, '#fff');
  }
  function container(x, y, w, h, color, label) {
    outlined(x, y, w, h, color);
    for (let i = x + 6; i < x + w - 6; i += 8) rect(i, y + 4, 2, h - 8, shade(color, -30));
    if (label) textLabel(label, x + w / 2, y + h / 2, 8, '#fff', 'center', 900);
  }

  function drawLandmark(lm) {
    const x = lm.x;
    const base = BASE;
    ctx.save();
    switch (lm.type) {
      // ---------- 오산 ----------
      case 'osanStation': { // 철로 위 입체 환승센터: 데크 위 곡선 지붕, 아래엔 1호선 전동차
        rails(x, base - 12, 260);
        train(x + 20, base - 12, 150, '#2b4a86', '#f2f2f2', '1호선');
        rect(x + 30, base - 150, 14, 138, '#a9b0b8'); rect(x + 216, base - 150, 14, 138, '#a9b0b8');
        outlined(x + 10, base - 160, 240, 22, '#c9d0d6');
        outlined(x + 20, base - 226, 220, 68, '#e4e8ec');
        for (let i = 0; i < 6; i += 1) glass(x + 32 + i * 34, base - 214, 26, 44, '#7cc4ea');
        ctx.fillStyle = '#f4f6f7'; ctx.beginPath(); ctx.moveTo(x + 8, base - 226); ctx.quadraticCurveTo(x + 130, base - 300, x + 252, base - 226); ctx.lineTo(x + 252, base - 216); ctx.quadraticCurveTo(x + 130, base - 288, x + 8, base - 216); ctx.fill();
        signboard(x + 70, base - 258, 120, 24, '#1f4e8c', '오산역 환승센터', '#fff', 11);
        rect(x + 120, base - 138, 20, 126, '#8fd0f0'); rect(x + 128, base - 138, 3, 126, '#3d5a73');
        break;
      }
      case 'osakMarket': { // 오색시장: 붉은 아치 간판과 색색 천막 노점
        rect(x + 6, base - 190, 10, 190, '#8a3b2f'); rect(x + 244, base - 190, 10, 190, '#8a3b2f');
        ctx.fillStyle = '#c9463b'; ctx.beginPath(); ctx.moveTo(x, base - 180); ctx.quadraticCurveTo(x + 130, base - 260, x + 260, base - 180); ctx.lineTo(x + 260, base - 160); ctx.quadraticCurveTo(x + 130, base - 238, x, base - 160); ctx.fill();
        textLabel('오색시장', x + 130, base - 202, 18, '#fff7e0', 'center', 900);
        const colors = [['#e0453c', '#fff'], ['#2f9a4a', '#fff'], ['#f2c531', '#fff'], ['#2f5fb3', '#fff'], ['#e8783c', '#fff']];
        for (let i = 0; i < 5; i += 1) {
          const sx = x + 14 + i * 48;
          rect(sx + 4, base - 120, 4, 120, '#6b4a32'); rect(sx + 38, base - 120, 4, 120, '#6b4a32');
          awning(sx, base - 128, 46, colors[i][0], colors[i][1]);
          outlined(sx + 2, base - 60, 42, 60, i % 2 ? '#e6d3a8' : '#d9c6a0');
          rect(sx + 8, base - 52, 12, 10, colors[(i + 1) % 5][0]); rect(sx + 24, base - 52, 12, 10, colors[(i + 2) % 5][0]); rect(sx + 8, base - 38, 28, 8, '#b57242');
        }
        for (let i = 0; i < 8; i += 1) rect(x + 20 + i * 30, base - 150 + (i % 2) * 6, 10, 12, '#f2c531');
        break;
      }
      case 'hapkido': {
        outlined(x, base - 240, 200, 240, '#d8dbe0'); rect(x, base - 240, 200, 10, '#2b3240');
        rect(x + 32, base - 230, 136, 230, '#2f3a4e');
        signboard(x + 14, base - 226, 172, 40, '#1f2a3d', '합기도', '#fff', 20);
        taegeuk(x + 38, base - 206, 9); taegeuk(x + 162, base - 206, 9);
        for (let r = 0; r < 3; r += 1) { glass(x + 40, base - 178 + r * 40, 34, 30); glass(x + 126, base - 178 + r * 40, 34, 30); }
        outlined(x + 83, base - 182, 34, 104, '#f4f1ea');
        ['합', '기', '도'].forEach((ch, i) => textLabel(ch, x + 100, base - 160 + i * 30, 17, '#1f2a3d', 'center', 900));
        signboard(x + 24, base - 72, 152, 26, '#1f2a3d', 'OSAN HAPKIDO', '#fff', 11);
        glass(x + 76, base - 42, 48, 42, '#7cc4ea'); rect(x + 99, base - 42, 2, 42, '#3d5a73');
        outlined(x + 38, base - 40, 26, 38, '#f4f1ea'); textLabel('예의', x + 51, base - 21, 7, '#1f2a3d', 'center', 900);
        outlined(x + 136, base - 40, 26, 38, '#f4f1ea'); rect(x + 144, base - 32, 10, 22, '#1f2a3d');
        rect(x + 8, base - 22, 14, 22, '#3f8f45'); rect(x + 178, base - 22, 14, 22, '#3f8f45');
        break;
      }
      case 'haedong': {
        outlined(x, base - 250, 200, 250, '#d8dbe0'); rect(x, base - 250, 200, 10, '#2b3240');
        outlined(x + 14, base - 240, 172, 132, '#1d2740');
        ring(x + 100, base - 202, 22, 4, '#f4f1ea'); taegeuk(x + 100, base - 202, 14); rect(x + 98, base - 226, 4, 48, '#f4f1ea');
        textLabel('해동검도', x + 100, base - 160, 19, '#fff', 'center', 900);
        textLabel('HAEDONG KUMDO', x + 100, base - 142, 8, '#fff', 'center', 900);
        textLabel('정직 · 인내 · 용기', x + 100, base - 122, 9, '#dfe6f0', 'center', 900);
        for (let i = 0; i < 4; i += 1) glass(x + 20 + i * 41, base - 104, 36, 32);
        rect(x + 28, base - 66, 144, 10, '#2b3a63'); rect(x + 28, base - 56, 144, 2, '#1a2440');
        glass(x + 75, base - 54, 50, 54, '#7cc4ea'); rect(x + 99, base - 54, 2, 54, '#3d5a73');
        outlined(x + 32, base - 52, 22, 46, '#f4f1ea'); textLabel('예의', x + 43, base - 29, 7, '#1f2a3d', 'center', 900);
        outlined(x + 146, base - 52, 22, 46, '#1f2a3d'); textLabel('검도', x + 157, base - 29, 7, '#fff', 'center', 900);
        rect(x + 8, base - 22, 14, 22, '#3f8f45'); rect(x + 178, base - 22, 14, 22, '#3f8f45');
        break;
      }
      // ---------- 병점 · 동탄 ----------
      case 'byeongjeom': { // 병점역: 둥근 유리 정면과 코레일 파란 띠
        outlined(x, base - 170, 200, 170, '#e4e8ec'); rect(x, base - 170, 200, 8, '#5d6773');
        ctx.fillStyle = '#7cc4ea'; ctx.beginPath(); ctx.arc(x + 100, base - 60, 70, Math.PI, 0); ctx.fill();
        ctx.strokeStyle = '#3d5a73'; ctx.lineWidth = 3; for (let i = -2; i <= 2; i += 1) { ctx.beginPath(); ctx.moveTo(x + 100, base - 60); ctx.lineTo(x + 100 + i * 32, base - 124); ctx.stroke(); }
        rect(x + 30, base - 60, 140, 60, '#d5dbe0'); glass(x + 76, base - 50, 48, 50, '#8fd0f0'); rect(x + 99, base - 50, 2, 50, '#3d5a73');
        rect(x + 10, base - 150, 180, 14, '#1f4e8c'); textLabel('병점역  Byeongjeom', x + 100, base - 143, 9, '#fff', 'center', 900);
        rect(x + 14, base - 132, 40, 6, '#1f4e8c'); rect(x + 146, base - 132, 40, 6, '#1f4e8c');
        outlined(x + 160, base - 90, 34, 90, '#2f9a4a'); textLabel('버스', x + 177, base - 70, 8, '#fff', 'center', 900);
        break;
      }
      case 'metapolis': { // 메타폴리스: 동탄의 66층 쌍둥이 주상복합
        const towers = [[x + 20, 74, 320], [x + 128, 80, 345]];
        for (const [tx, tw, th] of towers) {
          outlined(tx, base - th, tw, th, '#3f5a80');
          for (let wy = base - th + 12; wy < base - 40; wy += 14) rect(tx + 6, wy, tw - 12, 6, hash(wy * 3 + tx) < .5 ? '#9cc9ea' : '#6f9cc4');
          rect(tx + 12, base - th - 26, tw - 24, 26, '#33496a'); rect(tx + tw / 2 - 2, base - th - 46, 4, 20, '#2a3a52'); rect(tx + tw / 2 - 3, base - th - 50, 6, 4, (Math.floor(state.elapsed * 2) % 2) ? '#ff5b4a' : '#7a2a24');
          rect(tx + 2, base - 40, tw - 4, 40, '#dfe4e9');
        }
        rect(x + 94, base - 200, 34, 12, '#33496a');
        signboard(x + 44, base - 26, 140, 22, '#1d2740', 'METAPOLIS', '#fff', 11);
        break;
      }
      case 'dongtanStation': { // 동탄역: 물결 지붕 지하역 출입 홀과 SRT 열차
        rails(x, base - 12, 260);
        train(x + 90, base - 12, 150, '#5a2d5c', '#e9d8ec', 'SRT');
        outlined(x + 10, base - 118, 240, 62, '#e6eaee');
        for (let i = 0; i < 7; i += 1) glass(x + 20 + i * 33, base - 108, 26, 40, '#8fd0f0');
        ctx.fillStyle = '#c7d2db'; ctx.beginPath(); ctx.moveTo(x, base - 118);
        for (let i = 0; i <= 4; i += 1) ctx.quadraticCurveTo(x + 32 + i * 65, base - 170, x + 65 + i * 65, base - 118);
        ctx.lineTo(x + 260, base - 106); ctx.lineTo(x, base - 106); ctx.fill();
        signboard(x + 60, base - 160, 140, 26, '#5a2d5c', '동탄역  SRT · GTX-A', '#fff', 10);
        break;
      }
      case 'lotte': { // 롯데백화점 동탄점
        outlined(x, base - 250, 240, 250, '#e9e2d6'); rect(x, base - 250, 240, 10, '#9e948a');
        rect(x + 14, base - 230, 212, 120, '#f4f0ea');
        for (let i = 0; i < 5; i += 1) rect(x + 24 + i * 40, base - 220, 24, 100, '#d9d1c6');
        outlined(x + 40, base - 200, 160, 42, '#fff'); textLabel('LOTTE', x + 120, base - 179, 24, '#c9463b', 'center', 900);
        textLabel('롯데백화점 동탄점', x + 120, base - 96, 12, '#5b524a', 'center', 900);
        rect(x + 10, base - 70, 220, 8, '#c9d5dc'); for (let i = 0; i < 5; i += 1) glass(x + 20 + i * 42, base - 60, 34, 60, '#8fd0f0');
        rect(x + 20, base - 128, 60, 24, '#e0453c'); rect(x + 160, base - 128, 60, 24, '#2f5fb3');
        break;
      }
      case 'lakeComo': { // 레이크꼬모: 호숫가 이탈리아풍 아케이드
        outlined(x, base - 150, 240, 150, '#e6c9a4'); rect(x - 6, base - 160, 252, 14, '#b85c3f');
        for (let i = 0; i < 5; i += 1) { ctx.fillStyle = '#7a4b34'; ctx.beginPath(); ctx.arc(x + 32 + i * 44, base - 46, 16, Math.PI, 0); ctx.fill(); rect(x + 16 + i * 44, base - 46, 32, 46, '#7a4b34'); rect(x + 20 + i * 44, base - 44, 24, 42, '#f7d58a'); }
        for (let i = 0; i < 6; i += 1) glass(x + 14 + i * 38, base - 130, 22, 30, '#8fd0f0');
        for (let i = 0; i < 12; i += 1) rect(x + 8 + i * 20, base - 96 + (i % 2) * 4, 4, 4, (Math.floor(state.elapsed * 4) + i) % 3 ? '#ffe08a' : '#fff');
        signboard(x + 70, base - 190, 100, 24, '#3d3a36', 'LAKE COMO', '#fff', 11);
        break;
      }
      case 'luna': { // 동탄호수공원 루나분수: 거대한 흰 원형 조형물과 음악분수
        water(x, base - 30, 260, 30);
        ring(x + 130, base - 120, 62, 12, '#eef2f4'); ring(x + 130, base - 120, 62, 4, '#c8d2d8');
        jets(x + 20, base - 30, 9, 110, '#dff6ff');
        for (let i = 0; i < 12; i += 1) rect(x + 30 + i * 18, base - 150 - Math.abs(Math.sin(state.elapsed * 4 + i)) * 40, 3, 3, '#ffffff');
        rect(x, base - 8, 260, 8, '#b09a78'); for (let i = 0; i < 260; i += 12) rect(x + i, base - 8, 2, 8, '#8f7a5c');
        break;
      }
      case 'lakmon': { // 라크몽: 호수 앞 각진 흰 복합문화시설
        poly([[x + 10, base], [x + 10, base - 120], [x + 70, base - 170], [x + 150, base - 190], [x + 190, base - 130], [x + 190, base]], '#f2f3f4');
        poly([[x + 10, base - 120], [x + 70, base - 170], [x + 150, base - 190], [x + 190, base - 130], [x + 150, base - 176], [x + 70, base - 156]], '#c9ced3');
        for (let i = 0; i < 9; i += 1) rect(x + 20 + i * 18, base - 100, 4, 100, '#b98a5c');
        for (let i = 0; i < 4; i += 1) glass(x + 30 + i * 38, base - 92, 26, 50, '#8fd0f0');
        signboard(x + 60, base - 50, 80, 22, '#3d3a36', 'LAKMON', '#fff', 11);
        break;
      }
      // ---------- 신창 · 순천향대 ----------
      case 'sinchang': {
        rails(x, base - 12, 200); train(x - 10, base - 12, 120, '#2b4a86', '#f2f2f2', '1호선');
        outlined(x + 60, base - 150, 140, 90, '#c48a63'); brickTexture(x + 62, base - 148, 136, 86, '#c48a63');
        rect(x + 60, base - 150, 140, 8, '#5d6773');
        rect(x + 70, base - 140, 120, 16, '#1f4e8c'); textLabel('신창(순천향대)역', x + 130, base - 132, 9, '#fff', 'center', 900);
        for (let i = 0; i < 3; i += 1) glass(x + 74 + i * 40, base - 112, 30, 30, '#8fd0f0');
        rect(x + 60, base - 60, 140, 48, '#8fa4b3');
        break;
      }
      case 'schLake': { // 순천향호: 연못, 갈대, 나무다리
        water(x, base - 46, 260, 46, '#5f9fb8');
        for (let i = 0; i < 6; i += 1) pxCircle(x + 30 + i * 40, base - 20 + (i % 2) * 8, 6, '#4f9a5a');
        for (let i = 0; i < 9; i += 1) rect(x + 8 + i * 28, base - 70, 2, 26, '#8ea35b');
        rect(x + 90, base - 60, 90, 8, '#8b6b4a'); for (let i = 0; i < 5; i += 1) rect(x + 92 + i * 20, base - 74, 3, 14, '#8b6b4a'); rect(x + 90, base - 74, 90, 3, '#8b6b4a');
        tree(x + 10, base - 130, '#4f9a5a'); tree(x + 200, base - 140, '#3f8f45'); tree(x + 236, base - 120, '#5aa653');
        rect(x + 140, base - 32, 8, 5, '#fff'); rect(x + 146, base - 36, 4, 4, '#fff');
        break;
      }
      case 'eastGate': { // 향설동문: 돌기둥과 가로대
        outlined(x + 40, base - 140, 26, 140, '#d8d3c8'); outlined(x + 134, base - 140, 26, 140, '#d8d3c8');
        rect(x + 40, base - 146, 120, 10, '#2f6b92'); rect(x + 40, base - 150, 120, 4, '#f4f1ea');
        signboard(x + 58, base - 135, 84, 22, '#2f6b92', '향설동문', '#fff', 12);
        textLabel('SOONCHUNHYANG UNIV.', x + 100, base - 104, 7, '#f4f1ea', 'center', 900);
        rect(x + 70, base - 90, 60, 6, '#7a674c'); lamp(x + 20, base); lamp(x + 180, base);
        break;
      }
      case 'cZone': { // 학예관 · BRIX관
        outlined(x, base - 190, 110, 190, '#eee6d3'); rect(x, base - 190, 110, 12, '#2f6b92'); textLabel('학예관', x + 55, base - 184, 9, '#fff', 'center', 900);
        for (let r = 0; r < 4; r += 1) for (let c = 0; c < 3; c += 1) glass(x + 12 + c * 32, base - 170 + r * 36, 22, 24, '#6fb9e2');
        outlined(x + 120, base - 240, 120, 240, '#3b4a5c'); for (let wy = base - 228; wy < base - 40; wy += 18) rect(x + 126, wy, 108, 9, '#8fd0f0');
        signboard(x + 140, base - 40, 80, 26, '#f2c531', 'BRIX', '#1d2740', 14);
        break;
      }
      case 'dorms': { // 향설생활관 · 글로벌빌리지
        [['향설1', 200, '#dce6ee'], ['GLOBAL', 250, '#c9dbe8'], ['향설3', 220, '#dce6ee']].forEach(([label, h, wall], i) => {
          const bx = x + i * 82; outlined(bx, base - h, 76, h, wall); rect(bx, base - h, 76, 10, '#569ab8');
          for (let wy = base - h + 20; wy < base - 30; wy += 22) { rect(bx + 6, wy + 12, 64, 3, '#8aa4b8'); for (let c = 0; c < 3; c += 1) glass(bx + 10 + c * 22, wy, 14, 12, '#7cc4ea'); }
          textLabel(label, bx + 38, base - h - 8, 8, '#2f6b92', 'center', 900);
        });
        break;
      }
      case 'bZone': { // 학생회관(시계탑) · I'Design관
        outlined(x, base - 200, 130, 200, '#e4e7eb'); rect(x, base - 200, 130, 10, '#2f6b92');
        pxCircle(x + 65, base - 160, 22, '#f4f1ea'); ring(x + 65, base - 160, 22, 3, '#2f3a4e');
        ctx.strokeStyle = '#2f3a4e'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x + 65, base - 160); ctx.lineTo(x + 65, base - 176); ctx.moveTo(x + 65, base - 160); ctx.lineTo(x + 77, base - 154); ctx.stroke();
        for (let r = 0; r < 3; r += 1) for (let c = 0; c < 4; c += 1) glass(x + 12 + c * 30, base - 124 + r * 34, 20, 22, '#6fb9e2');
        textLabel('학생회관', x + 65, base - 14, 10, '#2f6b92', 'center', 900);
        outlined(x + 140, base - 170, 100, 170, '#f4f1ea');
        ['#e0453c', '#f2c531', '#2f9a4a', '#2f5fb3'].forEach((c, i) => rect(x + 148 + (i % 2) * 44, base - 158 + Math.floor(i / 2) * 60, 40, 52, c));
        signboard(x + 150, base - 40, 80, 24, '#1d2740', "I'Design", '#fff', 10);
        break;
      }
      case 'library': { // 향설도서관: 열주와 계단이 있는 큰 건물
        outlined(x, base - 230, 240, 230, '#e9e6de'); rect(x, base - 230, 240, 12, '#2f6b92');
        poly([[x + 20, base - 218], [x + 120, base - 262], [x + 220, base - 218]], '#d2cfc6');
        for (let i = 0; i < 6; i += 1) rect(x + 22 + i * 38, base - 200, 14, 150, '#f7f5ef');
        for (let i = 0; i < 5; i += 1) glass(x + 42 + i * 38, base - 190, 20, 60, '#6fb9e2');
        signboard(x + 60, base - 120, 120, 22, '#2f6b92', '향설도서관', '#fff', 11);
        rect(x + 10, base - 50, 220, 10, '#cfcabf'); rect(x + 20, base - 40, 200, 10, '#c4bfb4'); rect(x + 30, base - 30, 180, 10, '#b9b4a9'); rect(x + 40, base - 20, 160, 20, '#aea99e');
        glass(x + 100, base - 90, 40, 42, '#8fd0f0');
        break;
      }
      case 'humanLove': {
        outlined(x, base - 200, 200, 200, '#f4f4f2'); rect(x, base - 200, 200, 14, '#2d6491');
        for (let r = 0; r < 5; r += 1) for (let c = 0; c < 6; c += 1) glass(x + 12 + c * 31, base - 176 + r * 30, 20, 18, '#789fad');
        signboard(x + 30, base - 50, 140, 24, '#2d6491', '인간사랑관', '#fff', 12);
        rect(x + 20, base - 22, 160, 22, '#c9c4b9');
        break;
      }
      // ---------- 광진 ----------
      case 'childrenStation': { // 어린이대공원역 7호선 출입구
        outlined(x + 20, base - 90, 120, 90, '#c8d1d4'); rect(x + 20, base - 90, 120, 10, '#6b7d46');
        pxCircle(x + 50, base - 60, 14, '#6b7d46'); textLabel('7', x + 50, base - 60, 14, '#fff', 'center', 900);
        textLabel('어린이대공원역', x + 100, base - 60, 10, '#26313a', 'center', 900);
        rect(x + 40, base - 40, 80, 40, '#6b7d46'); for (let i = 0; i < 5; i += 1) rect(x + 44, base - 36 + i * 8, 72, 3, '#3d4a2b');
        outlined(x + 150, base - 120, 40, 120, '#c8d1d4'); glass(x + 156, base - 110, 28, 90, '#8fd0f0'); textLabel('E/V', x + 170, base - 12, 7, '#26313a', 'center', 900);
        tree(x + 4, base - 90, '#4e985c');
        break;
      }
      case 'sejongGate': { // 세종대학교 정문: 전통 기와 양식의 문과 붉은 벽돌 대양홀
        outlined(x + 100, base - 170, 100, 170, '#b65b44'); brickTexture(x + 102, base - 168, 96, 130, '#b65b44');
        for (let r = 0; r < 3; r += 1) for (let c = 0; c < 3; c += 1) glass(x + 108 + c * 30, base - 150 + r * 36, 20, 24, '#7cc4ea');
        rect(x + 4, base - 120, 14, 120, '#a9382d'); rect(x + 44, base - 120, 14, 120, '#a9382d'); rect(x + 76, base - 120, 14, 120, '#a9382d');
        hanokRoof(x - 6, base - 170, 106, 44, '#3e4750');
        rect(x + 4, base - 126, 86, 6, '#2a2f34');
        signboard(x + 10, base - 112, 74, 20, '#1f2a3d', '세종대학교', '#fff', 9);
        rect(x + 18, base - 90, 26, 90, '#e0453c'); rect(x + 58, base - 90, 18, 90, '#e0453c');
        break;
      }
      case 'parkGate': { // 서울어린이대공원 정문: 넓은 흰 문과 풍선
        outlined(x + 10, base - 140, 30, 140, '#e6e3dc'); outlined(x + 200, base - 140, 30, 140, '#e6e3dc');
        outlined(x + 60, base - 100, 20, 100, '#e6e3dc'); outlined(x + 160, base - 100, 20, 100, '#e6e3dc');
        rect(x + 10, base - 150, 220, 12, '#c9463b'); textLabel('서울어린이대공원', x + 120, base - 172, 16, '#c9463b', 'center', 900);
        textLabel("SEOUL CHILDREN'S GRAND PARK", x + 120, base - 122, 7, '#4a5563', 'center', 900);
        ['#e0453c', '#f2c531', '#2f9a4a', '#2f5fb3', '#d9538a'].forEach((c, i) => { const bx = x + 30 + i * 42, by = base - 190 - Math.sin(state.elapsed * 2 + i) * 6; pxCircle(bx, by, 8, c); rect(bx, by + 8, 1, 30, '#4a5563'); });
        for (let i = 0; i < 4; i += 1) tree(x + 90 + i * 30 - 40, base - 80, i % 2 ? '#4e985c' : '#3f8f45');
        break;
      }
      case 'musicFountain': { // 음악분수와 층단형 꿈마루
        outlined(x + 60, base - 170, 150, 60, '#c5bfa9'); outlined(x + 90, base - 120, 150, 40, '#b7b19b'); outlined(x + 120, base - 90, 120, 30, '#a9a38d');
        textLabel('꿈마루', x + 165, base - 142, 11, '#414b4d', 'center', 900);
        water(x, base - 36, 250, 36, '#72b0cb'); ring(x + 110, base - 20, 60, 6, '#d9d3c7');
        jets(x + 20, base - 30, 8, 90); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x + 110, base - 30); ctx.lineTo(x + 110, base - 150 - Math.sin(state.elapsed * 3) * 20); ctx.stroke();
        break;
      }
      case 'octagon': { // 팔각당
        poly([[x + 40, base - 130], [x + 70, base - 150], [x + 130, base - 150], [x + 160, base - 130], [x + 160, base], [x + 40, base]], '#eadcc6');
        poly([[x + 24, base - 130], [x + 100, base - 200], [x + 176, base - 130]], '#c94c3e');
        poly([[x + 60, base - 160], [x + 100, base - 226], [x + 140, base - 160]], '#a33d31'); rect(x + 98, base - 240, 4, 16, '#3e4750');
        for (let i = 0; i < 4; i += 1) glass(x + 54 + i * 26, base - 112, 18, 28, '#83aeb4');
        rect(x + 84, base - 50, 32, 50, '#77513b'); textLabel('팔각당', x + 100, base - 70, 12, '#77513b', 'center', 900);
        break;
      }
      case 'greenhouse': { // 식물원 유리 온실
        dome(x + 100, base - 60, 90, '#b8d9d2'); rect(x + 10, base - 60, 180, 60, '#b8d9d2');
        ctx.strokeStyle = '#668c83'; ctx.lineWidth = 3;
        for (let i = 0; i < 7; i += 1) { ctx.beginPath(); ctx.moveTo(x + 10 + i * 30, base); ctx.lineTo(x + 100 + (i - 3) * 12, base - 150); ctx.stroke(); }
        ctx.beginPath(); ctx.arc(x + 100, base - 60, 60, Math.PI, 0); ctx.stroke();
        for (let i = 0; i < 6; i += 1) { rect(x + 22 + i * 28, base - 40, 6, 40, '#3f8f45'); pxCircle(x + 25 + i * 28, base - 48, 10, '#4fa653'); }
        signboard(x + 60, base - 30, 80, 20, '#355f58', '식물원', '#fff', 10);
        break;
      }
      case 'gwangnaru20': { // 군자동 저층 주택 골목: 옥상 물탱크, 전봇대
        outlined(x + 20, base - 150, 160, 150, '#d8d0c8'); brickTexture(x + 22, base - 148, 156, 60, '#d8d0c8');
        rect(x + 20, base - 156, 160, 8, '#665f5a'); pxCircle(x + 60, base - 170, 12, '#f2c531'); rect(x + 48, base - 170, 24, 14, '#f2c531');
        for (let r = 0; r < 3; r += 1) for (let c = 0; c < 4; c += 1) glass(x + 34 + c * 36, base - 136 + r * 40, 22, 24, '#789ba6');
        signboard(x + 30, base - 46, 60, 20, '#6c8d77', '세탁', '#fff', 9); signboard(x + 110, base - 46, 60, 20, '#b57242', '슈퍼', '#fff', 9);
        rect(x + 190, base - 200, 6, 200, '#5a5148'); rect(x + 176, base - 190, 34, 4, '#5a5148'); rect(x + 180, base - 176, 26, 4, '#5a5148');
        ctx.strokeStyle = '#3b4350'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x + 176, base - 188); ctx.quadraticCurveTo(x + 90, base - 160, x - 40, base - 180); ctx.stroke();
        break;
      }
      // ---------- 성수 ----------
      case 'seongsuStation': { // 성수역: 2호선 고가 위 초록 전동차
        rect(x + 30, base - 140, 18, 140, '#9aa3aa'); rect(x + 212, base - 140, 18, 140, '#9aa3aa'); rect(x + 121, base - 140, 18, 140, '#9aa3aa');
        outlined(x, base - 160, 260, 24, '#b8c0c6'); rails(x, base - 168, 260);
        train(x + 40, base - 168, 170, '#2f9a4a', '#f2f2f2', '2호선');
        outlined(x + 60, base - 100, 140, 100, '#c8d1d4'); signboard(x + 70, base - 92, 120, 22, '#2f9a4a', '성수역 ②', '#fff', 11);
        for (let i = 0; i < 6; i += 1) rect(x + 70, base - 60 + i * 9, 120, 3, '#3d5a73');
        break;
      }
      case 'shoeStreet': { // 성수 수제화거리: 큰 구두 조형
        outlined(x, base - 150, 200, 150, '#ad6c53'); brickTexture(x + 2, base - 148, 196, 146, '#ad6c53');
        rect(x + 12, base - 110, 82, 110, '#4f5d61'); rect(x + 106, base - 104, 84, 104, '#ded0b9');
        rect(x + 24, base - 100, 60, 40, '#f1e7cf'); rect(x + 30, base - 88, 48, 12, '#413c39'); rect(x + 56, base - 112, 24, 22, '#f1e7cf');
        signboard(x + 20, base - 190, 160, 26, '#3d3a36', 'SEONGSU 수제화거리', '#fff', 10);
        for (let i = 0; i < 3; i += 1) { rect(x + 116 + i * 24, base - 70, 18, 8, '#3d3a36'); rect(x + 116 + i * 24, base - 78, 10, 8, '#c94c3e'); }
        glass(x + 130, base - 46, 40, 46, '#8fd0f0');
        break;
      }
      case 'daelim': { // 대림창고: 붉은 벽돌 창고와 톱니 지붕
        outlined(x, base - 170, 240, 170, '#8b5847'); brickTexture(x + 2, base - 168, 236, 166, '#8b5847');
        for (let i = 0; i < 4; i += 1) poly([[x + i * 60, base - 170], [x + i * 60 + 40, base - 210], [x + i * 60 + 60, base - 170]], '#6f4339');
        for (let i = 0; i < 4; i += 1) rect(x + i * 60 + 40, base - 208, 18, 36, '#8fd0f0');
        ctx.fillStyle = '#3d3a36'; ctx.beginPath(); ctx.arc(x + 120, base - 60, 40, Math.PI, 0); ctx.fill(); rect(x + 80, base - 60, 80, 60, '#3d3a36'); glass(x + 96, base - 70, 48, 70, '#4f6d80');
        textLabel('대림창고', x + 120, base - 130, 22, '#f4e4cd', 'center', 900);
        for (let i = 0; i < 5; i += 1) rect(x + 10 + i * 8, base - 120 - i * 14, 6, 6, '#4f9a5a');
        break;
      }
      case 'sFactory': { // 에스팩토리: 회색 공장과 굴뚝
        outlined(x, base - 180, 200, 180, '#4f5355'); for (let i = x + 8; i < x + 192; i += 10) rect(i, base - 176, 3, 120, '#3f4345');
        rect(x + 160, base - 260, 24, 100, '#6a6e70'); rect(x + 156, base - 266, 32, 8, '#3d4143');
        for (let i = 0; i < 3; i += 1) rect(x + 165 + Math.sin(state.elapsed + i) * 6, base - 290 - i * 18, 10 + i * 4, 8, 'rgba(230,230,230,.6)');
        rect(x + 12, base - 150, 176, 60, '#77969d'); for (let i = 0; i < 4; i += 1) glass(x + 20 + i * 42, base - 142, 32, 44, '#a9cbd3');
        rect(x + 20, base - 60, 160, 60, '#252a2c'); textLabel('S-FACTORY', x + 100, base - 100, 18, '#fff', 'center', 900);
        glass(x + 80, base - 50, 40, 50, '#8fd0f0');
        break;
      }
      case 'seongsuComplex': { // 성수연방 · LCDC: 벽돌 공장 단지와 옥외 계단
        outlined(x, base - 150, 110, 150, '#a35e49'); brickTexture(x + 2, base - 148, 106, 146, '#a35e49');
        outlined(x + 120, base - 200, 120, 200, '#c7b7a3'); for (let r = 0; r < 4; r += 1) for (let c = 0; c < 4; c += 1) glass(x + 130 + c * 26, base - 184 + r * 40, 18, 28, '#698e98');
        for (let i = 0; i < 6; i += 1) rect(x + 30 + i * 12, base - 40 - i * 14, 12, 4, '#3d3a36'); rect(x + 30, base - 124, 4, 124, '#3d3a36'); rect(x + 100, base - 124, 4, 124, '#3d3a36');
        textLabel('성수연방', x + 55, base - 134, 12, '#fff', 'center', 900);
        signboard(x + 140, base - 40, 80, 26, '#3d403f', 'LCDC', '#fff', 14);
        break;
      }
      case 'flagships': { // 디올 성수(흰 격자 유리 파빌리온) · 아모레성수(낮은 회색 콘크리트와 정원)
        rect(x + 10, base - 200, 110, 200, 'rgba(255,255,255,.55)');
        ctx.strokeStyle = '#f7f7f7'; ctx.lineWidth = 3;
        for (let i = 0; i <= 5; i += 1) { ctx.beginPath(); ctx.moveTo(x + 10 + i * 22, base); ctx.lineTo(x + 10 + i * 22, base - 200); ctx.stroke(); }
        for (let i = 0; i <= 8; i += 1) { ctx.beginPath(); ctx.moveTo(x + 10, base - i * 25); ctx.lineTo(x + 120, base - i * 25); ctx.stroke(); }
        ctx.strokeStyle = '#c9d2d8'; ctx.lineWidth = 2; ctx.strokeRect(x + 10, base - 200, 110, 200);
        textLabel('DIOR', x + 65, base - 214, 14, '#3d3a36', 'center', 900);
        outlined(x + 130, base - 110, 110, 110, '#8e8b86'); rect(x + 136, base - 104, 98, 40, '#a7a49f');
        for (let i = 0; i < 4; i += 1) glass(x + 140 + i * 24, base - 56, 18, 46, '#7e9a82');
        tree(x + 150, base - 190, '#4f9a5a'); tree(x + 196, base - 180, '#3f8f45');
        textLabel('AMORE', x + 185, base - 124, 11, '#3d3a36', 'center', 900);
        break;
      }
      case 'understand': { // 언더스탠드에비뉴: 색색의 컨테이너
        const cs = ['#e8674f', '#557c91', '#e5b94e', '#3f8f45', '#2f5fb3', '#d9538a'];
        for (let i = 0; i < 6; i += 1) container(x + i * 40, base - 50, 38, 50, cs[i], i % 2 ? '' : 'SHOP');
        for (let i = 0; i < 5; i += 1) container(x + 20 + i * 40, base - 100, 38, 50, cs[(i + 3) % 6]);
        for (let i = 0; i < 3; i += 1) container(x + 60 + i * 40, base - 150, 38, 50, cs[(i + 1) % 6]);
        signboard(x + 40, base - 184, 160, 24, '#1d2740', 'UNDER STAND AVENUE', '#fff', 10);
        break;
      }
      case 'seoulForest': { // 서울숲: 숲, 거울연못, 사슴
        for (let i = 0; i < 8; i += 1) tree(x + i * 33, base - 96 - (i % 3) * 22, i % 2 ? '#397c4c' : '#559958');
        water(x + 10, base - 26, 240, 26, '#6ba6b5');
        deer(x + 100, base - 30); deer(x + 170, base - 34);
        rect(x + 40, base - 170, 160, 22, '#3d6e4d'); textLabel('서울숲  SEOUL FOREST', x + 120, base - 159, 11, '#fff', 'center', 900);
        break;
      }
      // ---------- 우주 ----------
      case 'earth': { // 발사대와 로켓
        rect(x + 40, base - 210, 14, 210, '#8a929c'); for (let i = 0; i < 9; i += 1) rect(x + 54, base - 200 + i * 22, 30, 4, '#8a929c');
        outlined(x + 90, base - 190, 40, 170, '#f2f2f2'); poly([[x + 90, base - 190], [x + 110, base - 236], [x + 130, base - 190]], '#e0453c');
        rect(x + 96, base - 120, 28, 30, '#e0453c'); glass(x + 102, base - 170, 16, 16, '#7cc4ea');
        poly([[x + 90, base - 60], [x + 74, base - 20], [x + 90, base - 20]], '#e0453c'); poly([[x + 130, base - 60], [x + 146, base - 20], [x + 130, base - 20]], '#e0453c');
        rect(x + 70, base - 20, 80, 20, '#5b6470');
        pxCircle(x + 190, base - 280, 40, '#3a8fc0'); rect(x + 165, base - 300, 30, 16, '#53a465'); rect(x + 195, base - 262, 26, 14, '#53a465');
        break;
      }
      case 'moon': { // 달 휴게소 돔과 로버
        dome(x + 100, base - 20, 80, '#c5bfd0'); rect(x + 20, base - 20, 160, 20, '#c5bfd0');
        for (let i = 0; i < 4; i += 1) glass(x + 50 + i * 30, base - 70, 20, 24, '#f6e7a8');
        rect(x + 98, base - 140, 4, 40, '#8f879e'); rect(x + 90, base - 146, 20, 6, '#8f879e');
        signboard(x + 50, base - 116, 100, 22, '#665b80', '달 휴게소', '#fff', 12);
        outlined(x + 150, base - 30, 44, 16, '#9e92b2'); pxCircle(x + 158, base - 8, 8, '#3d4143'); pxCircle(x + 186, base - 8, 8, '#3d4143'); rect(x + 166, base - 46, 3, 18, '#8f879e'); rect(x + 160, base - 50, 16, 6, '#7cc4ea');
        break;
      }
      default:
        outlined(x, base - 150, lm.width, 150, '#d8dbe0');
    }
    ctx.restore();
  }

  function drawObstacle(obstacle) {
    const x = obstacle.x;
    const { kind } = obstacle;
    const w = obstacle.width;
    const groundY = groundAtScreenX(x + w / 2);
    if (kind.type !== 'air') groundShadow(x + w / 2, w + 14);
    if (kind.type === 'air') {
      rect(x + 4, groundY - 190, 4, 124, OUTLINE);
      rect(x + w - 8, groundY - 190, 4, 124, OUTLINE);
      outlined(x, groundY - 130, w, 60, kind.color);
      rect(x + 5, groundY - 125, w - 10, 6, 'rgba(255,255,255,.5)');
      textLabel(kind.label, x + w / 2, groundY - 98, 9, '#fff', 'center', 900);
    } else if (kind.label.includes('콘')) {
      ctx.fillStyle = OUTLINE; ctx.beginPath(); ctx.moveTo(x + w / 2, groundY - 40); ctx.lineTo(x - 2, groundY - 4); ctx.lineTo(x + w + 2, groundY - 4); ctx.fill();
      ctx.fillStyle = kind.color; ctx.beginPath(); ctx.moveTo(x + w / 2, groundY - 36); ctx.lineTo(x + 1, groundY - 6); ctx.lineTo(x + w - 1, groundY - 6); ctx.fill();
      outlined(x - 4, groundY - 7, w + 8, 7, '#eee8d9');
      rect(x + 8, groundY - 22, w - 16, 5, '#fff0d4');
    } else if (kind.label.includes('벤치')) {
      outlined(x - 4, groundY - 32, w + 8, 10, kind.color);
      rect(x, groundY - 22, 4, 22, '#4d433b'); rect(x + w - 4, groundY - 22, 4, 22, '#4d433b');
      outlined(x - 4, groundY - 42, w + 8, 8, kind.color);
    } else if (kind.label.includes('화분')) {
      outlined(x, groundY - 24, w, 24, '#9b6445');
      outlined(x - 3, groundY - 32, w + 6, 9, kind.color);
      rect(x + 6, groundY - 50, w - 12, 20, '#3f8f45'); rect(x + 10, groundY - 56, w - 20, 8, '#3f8f45'); rect(x + 9, groundY - 46, 5, 5, '#7fc463');
    } else if (kind.label.includes('월석')) {
      outlined(x, groundY - 30, w, 30, kind.color);
      rect(x + 6, groundY - 40, w - 12, 12, shade(kind.color, 20));
      rect(x + 8, groundY - 22, 6, 5, shade(kind.color, -30)); rect(x + w - 12, groundY - 16, 5, 4, shade(kind.color, -30));
    } else {
      outlined(x, groundY - 36, w, 36, kind.color);
      rect(x + 2, groundY - 22, w - 4, 4, shade(kind.color, 45));
      rect(x + w / 2 - 2, groundY - 34, 4, 32, shade(kind.color, 45));
      rect(x + 5, groundY - 32, 6, 4, shade(kind.color, -40));
    }
  }

  function drawFood(pickup) {
    const x = pickup.x;
    const y = pickupY(pickup) + Math.sin(pickup.bob) * 3;
    ctx.drawImage(foodCanvases[pickup.food.id], Math.round(x - FOOD_SIZE / 2), Math.round(y - FOOD_SIZE / 2));
  }

  // 프레임 자체에 체공·접지 높이가 들어 있으므로 추가 상하 이동은 아주 작게만 준다.
  function booBob() {
    return 0;
  }

  function dogSample() {
    const target = state.worldX - DOG_GAP;
    for (let i = state.trail.length - 1; i >= 0; i -= 1) {
      if (state.trail[i].w <= target) return state.trail[i];
    }
    return { y: state.playerY, duck: state.ducking };
  }

  function drawCharacters() {
    if (state.currentRegion.id === 'space') {
      const centerY = GROUND + state.playerY - 48;
      const booFrame = Math.floor(state.runPhase * 6) % 6;
      const dogFrame = Math.floor((state.dogPhase + .36) * 6) % 6;
      drawCenteredSprite(sprites.dogFloat, dogFrame, 67, centerY + 72, .23, .05 + Math.sin(state.elapsed * 1.1) * .035);
      drawCenteredSprite(sprites.booFloat, booFrame, 152, centerY, .37, -.08 + Math.sin(state.elapsed * .9) * .045);
      return;
    }
    const dog = dogSample();
    const dogAir = dog.y < -1;
    const dogBob = dogAir || dog.duck ? 0 : -4 * (.5 - .5 * Math.cos(state.dogPhase * Math.PI * 2));
    if (state.currentRegion.id !== 'space') {
      groundShadow(DOG_FOOT_X, dog.duck ? 70 : 58, -dog.y);
      groundShadow(BOO_FOOT_X, state.ducking ? 96 : 46, -state.playerY);
    }
    drawDog(groundAtScreenX(DOG_FOOT_X) + dog.y + dogBob, dog.duck, dogAir, dog.vy || 0);
    drawBoo(groundAtScreenX(BOO_FOOT_X) + state.playerY + booBob(), state.ducking, !onGround());
  }

  function drawCenteredSprite(sprite, frame, centerX, centerY, scale, angle = 0) {
    if (!sprite) return false;
    const width = sprite.srcW * scale;
    const height = sprite.srcH * scale;
    ctx.save();
    ctx.translate(Math.round(centerX), Math.round(centerY));
    ctx.rotate(angle);
    // Generated source faces left; flip it so both characters float forward.
    ctx.scale(-1, 1);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(sprite.image, frame * sprite.fw, 0, sprite.fw, sprite.fh,
      -width / 2, -height / 2, width, height);
    ctx.restore();
    return true;
  }

  // 원본 이미지 좌표계로 그린다. 시트는 프레임 단위로 잘라 쓰고 좌우를 뒤집어 오른쪽을 보게 한다.
  // angle: 발 중심 기준 회전(라디안, +는 앞으로 기울기). squash: 착지 시 눌림(0~1)
  function drawSprite(sprite, frame, x, feetY, scale, angle = 0, squash = 0) {
    if (!sprite) return false;
    const { image, srcW, srcH, fw, fh, dx, dy } = sprite;
    const half = srcW * scale / 2;
    ctx.save();
    ctx.translate(Math.round(x + half), Math.round(feetY));
    if (angle) ctx.rotate(angle);
    if (squash) ctx.scale(1 + squash * .5, 1 - squash);
    ctx.translate(half, 0);
    ctx.scale(-1, 1);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(image, frame * fw, 0, fw, fh, dx * scale, (dy - srcH) * scale, fw * scale, fh * scale);
    ctx.restore();
    return true;
  }

  // 점프: 올라갈 때는 무릎을 끌어올린 프레임(4)으로 몸을 뒤로 젖히고, 정점에서 다리를 모으고(2),
  // 내려올 때는 다리를 앞으로 뻗은 프레임(0)으로 앞으로 기울인다. 착지하면 잠깐 눌린다.
  function jumpPose(vy, frames) {
    const up = vy < -260, down = vy > 260;
    return { frame: up ? Math.round(frames * .5) : down ? 0 : Math.round(frames * .25), angle: Math.max(-.16, Math.min(.16, vy / 5200)) };
  }

  function drawBoo(feetY, duck, airborne) {
    let drawn;
    const squash = state.landTimer > 0 ? Math.sin(state.landTimer / .14 * Math.PI) * .12 : 0;
    if (duck) drawn = drawSprite(sprites.booDuck, 0, 60, feetY, BOO_SCALE);
    else if (airborne) {
      const pose = jumpPose(state.playerVY, 8);
      drawn = drawSprite(sprites.booRun, pose.frame, BOO_X, feetY, BOO_SCALE, pose.angle);
    } else {
      const roadAngle = Math.max(-.13, Math.min(.13, groundAngleAtScreenX(BOO_FOOT_X)));
      drawn = drawSprite(sprites.booRun, Math.floor(state.runPhase * 8) % 8, BOO_X, feetY, BOO_SCALE, .035 + roadAngle * .62, squash);
    }
    if (!drawn) {
      const x = BOO_X + 30;
      rect(x + 14, feetY - 118, 27, 35, '#202024'); rect(x + 17, feetY - 89, 22, 46, '#f1eadf'); rect(x + 14, feetY - 48, 30, 36, '#202024'); rect(x + 18, feetY - 12, 8, 12, '#f7f7f5'); rect(x + 34, feetY - 12, 8, 12, '#f7f7f5');
    }
  }

  function drawDog(feetY, duck, airborne, vy = 0) {
    let drawn;
    if (duck) drawn = drawSprite(sprites.dogDuck, 0, DOG_X, feetY + 1, DOG_SCALE);
    else if (airborne) {
      // 뛰어오를 때는 네 발을 모은 프레임(3), 내려올 때는 몸을 쭉 뻗은 프레임(0)
      const pose = jumpPose(vy, 6);
      drawn = drawSprite(sprites.dogRun, pose.frame, DOG_X, feetY + 1, DOG_SCALE, pose.angle * .8);
    } else {
      const roadAngle = Math.max(-.13, Math.min(.13, groundAngleAtScreenX(DOG_FOOT_X)));
      drawn = drawSprite(sprites.dogRun, Math.floor(state.dogPhase * 6) % 6, DOG_X, feetY + 1, DOG_SCALE, roadAngle * .45);
    }
    if (!drawn) {
      const x = DOG_X;
      rect(x + 7, feetY - 38, 45, 28, '#f4efe5'); rect(x, feetY - 42, 24, 23, '#f4efe5'); rect(x + 45, feetY - 52, 10, 19, '#f4efe5'); rect(x + 10, feetY - 10, 7, 10, '#e0d7cb'); rect(x + 42, feetY - 10, 7, 10, '#e0d7cb');
    }
  }

  function drawParticles() {
    for (const p of state.particles) rect(p.x, p.y, p.size, p.size, p.color);
  }

  function drawHud(region) {
    if (state.mode === 'menu') return;
    rect(12, 17, 150, 50, 'rgba(255,255,255,.88)');
    rect(12, 17, 5, 50, region.accent);
    textLabel(region.name, 25, 34, 13, '#1f2932', 'left', 900);
    textLabel(`${Math.floor(state.distance)}m  ·  ${state.score.toLocaleString('ko-KR')}점`, 25, 53, 11, '#59636c', 'left', 800);
    textLabel(state.previewMode ? `살펴보기 · 무적` : daylight.name, 151, 34, 8, region.accent, 'right', 900);

    const total = foods.reduce((sum, food) => sum + state.counts[food.id], 0);
    rect(170, 18, 163, 48, 'rgba(255,255,255,.86)');
    foods.forEach((food, i) => {
      ctx.drawImage(foodCanvases[food.id], 186 + i * 52, 21, 22, 22);
      textLabel(String(state.counts[food.id]), 197 + i * 52, 57, 9, '#26313a', 'center', 900);
    });
    if (total > 0) textLabel(`+${total * 10}`, 325, 84, 9, '#e0553d', 'right', 900);

    if (state.regionBanner > 0) {
      const alpha = Math.min(1, state.regionBanner, (3.5 - state.regionBanner) * 3);
      ctx.save(); ctx.globalAlpha = alpha;
      rect(28, 120, 334, 74, 'rgba(18,25,34,.86)');
      textLabel(region.name, W / 2, 145, 25, '#fff', 'center', 900);
      textLabel(region.subtitle, W / 2, 174, 11, '#dce5ea', 'center', 800);
      ctx.restore();
    }

    if (state.landmarkCaptionTime > 0 && state.landmarkCaption) {
      const lm = state.landmarkCaption;
      const alpha = Math.min(1, state.landmarkCaptionTime, (4.2 - state.landmarkCaptionTime) * 4);
      ctx.save(); ctx.globalAlpha = alpha;
      rect(25, 214, 340, 59, 'rgba(255,255,255,.92)');
      rect(25, 214, 6, 59, region.accent);
      textLabel(lm.name, 42, 232, 14, '#202a33', 'left', 900);
      textLabel(lm.detail, 42, 255, 10, '#5b646d', 'left', 700);
      ctx.restore();
    }
  }

  function drawMenuBackdrop() {
    // A calm first view behind the menu, before gameplay begins.
    ctx.save(); ctx.globalAlpha = .45;
    drawCharacters();
    ctx.restore();
  }

  // ---- 입력 ----
  // 터치: 누르는 즉시 점프(공룡 게임과 같은 반응). 아래로 밀면 공중에서는 빠르게 착지하고 땅에서는 엎드린다.
  // 길게 누르면 착지 후 손을 뗄 때까지 엎드려 있는다.
  let touchStart = null;
  canvas.addEventListener('pointerdown', (event) => {
    if (state.paused) { togglePause(); return; }
    if (state.mode !== 'playing') return;
    touchStart = { x: event.clientX, y: event.clientY, time: performance.now(), swiped: false };
    jump();
  });

  canvas.addEventListener('pointermove', (event) => {
    if (!touchStart || state.mode !== 'playing' || touchStart.swiped) return;
    const dy = event.clientY - touchStart.y;
    if (dy > 26) {
      touchStart.swiped = true;
      pressDown();
    }
  });

  const endTouch = () => {
    if (!touchStart) return;
    releaseDown(touchStart.swiped ? .45 : 0);
    touchStart = null;
  };
  canvas.addEventListener('pointerup', endTouch);
  canvas.addEventListener('pointercancel', endTouch);

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    if (['Space', 'ArrowUp'].includes(event.code)) {
      event.preventDefault();
      if (event.code === 'ArrowUp') state.upHeld = true;
      jump();
    }
    if (event.code === 'ArrowDown') { event.preventDefault(); pressDown(); }
    if (event.code === 'KeyP' || event.code === 'Escape') togglePause();
  });
  window.addEventListener('keyup', (event) => {
    if (event.code === 'ArrowUp') state.upHeld = false;
    if (event.code === 'ArrowDown') releaseDown(0);
  });
  window.addEventListener('blur', () => {
    state.upHeld = false;
    state.downHeld = false;
    state.duckHeld = false;
  });

  startButton.addEventListener('click', () => resetGame(previewRegion.value));
  $('restartButton').addEventListener('click', () => resetGame(0));
  $('homeButton').addEventListener('click', () => { state.mode = 'menu'; gameOverPanel.hidden = true; startPanel.hidden = false; });
  pauseButton.addEventListener('click', (event) => { event.stopPropagation(); togglePause(); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state.mode === 'playing' && !state.paused) togglePause();
  });

  function frame(now) {
    const dt = Math.min(.034, (now - state.lastFrame) / 1000 || 0);
    state.lastFrame = now;
    update(dt);
    draw();
    if (location.hash === '#debug') {
      canvas.dataset.playerY = state.playerY.toFixed(2);
      canvas.dataset.playerVY = state.playerVY.toFixed(2);
      canvas.dataset.speedDrop = String(state.speedDrop);
      canvas.dataset.region = state.currentRegion.id;
      canvas.dataset.previewMode = String(state.previewMode);
      canvas.dataset.obstacleCount = String(state.obstacles.length);
    }
    requestAnimationFrame(frame);
  }

  // 주소 끝에 #debug 를 붙이면 콘솔에서 프레임을 직접 진행시켜 테스트할 수 있다.
  if (location.hash === '#debug') {
    window.__boo = {
      state, jump, pressDown, releaseDown, resetGame, playerBoxes, obstacleBox, dust,
      MIN_SPEED, MAX_SPEED, ACCELERATION, JUMP_VELOCITY, GRAVITY,
      step(dt, n = 1) { for (let i = 0; i < n; i += 1) update(dt); draw(); },
    };
  }

  requestAnimationFrame(frame);
})();
