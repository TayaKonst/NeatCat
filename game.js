const canvas = document.getElementById('gameCanvas');
const context = canvas.getContext('2d');

const GRAVITY = 0.4;
const JUMP_POWER = -10;
const SPEED = 5;
const ITEM_SIZE = 50;
const FIREWORK_DURATION = 60;
const FIREWORK_SCALE = 1.5;
const FIREWORK_SIZE = 200 * FIREWORK_SCALE;

let cat = {
    x: canvas.width / 2 - 25,
    y: canvas.height - 60,
    width: 50,
    height: 70,
    dy: 0,
    dx: 0,
    speed: SPEED,
    gravity: GRAVITY,
    jumpPower: JUMP_POWER,
    onGround: false,
    sliding: false
};

const images = {
    cat: loadImage('cat.png'),
    shelves: loadImage('shelves.png'),
    background: loadImage('house.png'),
    firework: loadImage('firework.png'),
    tv: loadImage('tv.png'),
    toy: loadImage('toy.png'),
    rug: loadImage('rug.png'),
    refrigerator: loadImage('refrigerator.png'),
    shoes: loadImage('shoes.png'),
    komod: loadImage('komod.png'),
    picture: loadImage('picture.png'),
    fruits: loadImage('fruits.png'),
    sink: loadImage('sink.png'),
    soap: loadImage('soap.png'),
    closet: loadImage('closet.png'),
    pillow: loadImage('pillow.png'),
    chair: loadImage('chair.png')
};

const rooms = {
    bathroom: { x: 180, y: 130, width: 210, height: 130 },
    kitchen: { x: 420, y: 130, width: 210, height: 130 },
    kids_room: { x: 180, y: 265, width: 210, height: 150 },
    parents_room: { x: 420, y: 265, width: 210, height: 150 },
    living_room: { x: 180, y: 410, width: 210, height: 170 },
    hall: { x: 420, y: 410, width: 210, height: 170 }
};

// Определяем предопределенные позиции для каждого предмета
const itemPositions = {
    toy: { x: 190, y: 286 },
    tv: { x: 225, y: 501 },
    rug: { x: 321, y: 550 },
    refrigerator: { x: 430, y: 170},
    shoes: { x: 506, y: 498 },
    komod: { x: 506, y: 498 },
    picture: { x: 545, y: 280 },
    fruits: { x: 543, y: 189 },
    sink: { x: 383, y: 193 },
    soap: { x: 372, y: 191 },
    closet: { x: 227, y: 315 },
    chair: { x: 84, y: 511 }
};

const items = [
    createItem('toy.png', 'kids_room', 950, 100),
    createItem('tv.png', 'living_room', 950, 190),
    createItem('rug.png', 'living_room', 950, 280),
    createItem('refrigerator.png', 'kitchen', 950, 550),
    createItem('shoes.png', 'hall', 1080, 190),
    createItem('komod.png', 'hall', 1080, 280),
    createItem('picture.png', 'parents_room', 1080, 370),
    createItem('fruits.png', 'kitchen', 1080, 465),
    createItem('sink.png', 'bathroom', 950, 370),
    createItem('soap.png', 'bathroom', 1080, 100),
    createItem('closet.png', 'kids_room', 950, 460),
    createItem('chair.png', 'living_room', 1080, 550)
];

const platforms = [
    { x: 100, y: canvas.height - 170, width: 700, height: 10 },
    { x: 100, y: canvas.height - 343, width: 700, height: 10 },
    ...Array.from({ length: 6 }, (_, i) => ({ x: 950, y: 100 + i * 90, width: 200, height: 10 })),
    { x: 100, y: canvas.height - 50, width: 700, height: 10 }
];

let fireworksVisible = false;
let fireworksTimer = 0;

function loadImage(src) {
    const img = new Image();
    img.src = src;
    return img;
}

function createItem(src, room, x, y) {
    const img = loadImage(src);
    return { x, y, width: ITEM_SIZE, height: ITEM_SIZE, img, room, held: false, originalX: x, originalY: y, dy: 0 };
}

function updateCat() {
    if (!cat.sliding) {
        cat.dy += cat.gravity;
    }
    cat.y += cat.dy;
    cat.x += cat.dx;

    cat.onGround = false;
    platforms.forEach(platform => {
        if (isColliding(cat, platform)) {
            if (cat.sliding) {
                cat.onGround = false;
            } else {
                cat.y = platform.y - cat.height;
                cat.dy = 0;
                cat.onGround = true;
            }
        }
    });

    if (cat.y + cat.height > canvas.height) {
        cat.y = canvas.height - cat.height;
        cat.dy = 0;
        cat.onGround = true;
    }

    cat.x = Math.max(0, Math.min(cat.x, canvas.width - cat.width));
}

function updateItems() {
    items.forEach(item => {
        if (item.held) {
            item.x = cat.x;
            item.y = cat.y - item.height;
        } else {
            item.dy += GRAVITY;
            item.y += item.dy;

            platforms.forEach(platform => {
                if (isColliding(item, platform)) {
                    item.y = platform.y - item.height;
                    item.dy = 0;
                }
            });

            item.y = Math.min(item.y, canvas.height - item.height);
            item.x = Math.max(0, Math.min(item.x, canvas.width - item.width));
        }
    });

    if (fireworksVisible) {
        fireworksTimer--;
        if (fireworksTimer <= 0) {
            fireworksVisible = false;
        }
    }
}

function isColliding(obj1, obj2) {
    return obj1.x < obj2.x + obj2.width &&
           obj1.x + obj1.width > obj2.x &&
           obj1.y < obj2.y + obj2.height &&
           obj1.y + obj1.height + obj1.dy >= obj2.y;
}

function render() {
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(images.background, 0, 0, canvas.width - 316, canvas.height);
    context.drawImage(images.shelves, canvas.width - 316, 0, 316, canvas.height);

    context.drawImage(images.cat, cat.x, cat.y, cat.width, cat.height);

    items.forEach(item => {
        context.drawImage(item.img, item.x, item.y, item.width, item.height);
    });

    for (let room in rooms) {
        context.strokeStyle = 'rgba(0, 0, 0, 0)';
        context.strokeRect(rooms[room].x, rooms[room].y, rooms[room].width, rooms[room].height);
    }

    if (fireworksVisible) {
        context.shadowBlur = 20;
        context.shadowColor = 'rgba(0, 0, 0, 0.5)';
        context.drawImage(images.firework, (canvas.width - FIREWORK_SIZE) / 2, (canvas.height - FIREWORK_SIZE) / 2, FIREWORK_SIZE, FIREWORK_SIZE);
        context.shadowBlur = 0;
    }
}

// Функция для проверки и установки предмета в правильное место
function checkPlacement(item) {
    for (let room in rooms) {
        let roomData = rooms[room];
        if (item.x > roomData.x && item.x + item.width < roomData.x + roomData.width &&
            item.y > roomData.y && item.y + item.height < roomData.y + roomData.height) {
            if (item.room === room) {
                const itemName = item.img.src.split('/').pop().split('.')[0];
                item.x = itemPositions[itemName].x; // Устанавливаем новую координату x
                item.y = itemPositions[itemName].y; // Устанавливаем новую координату y
                showFireworks();
                return true;
            }
        }
    }
    return false;
}

function showFireworks() {
    fireworksVisible = true;
    fireworksTimer = FIREWORK_DURATION;
}

function handleKeyDown(event) {
    if (event.code === 'ArrowLeft') {
        cat.dx = -cat.speed;
    } else if (event.code === 'ArrowRight') {
        cat.dx = cat.speed;
    } else if (event.code === 'ArrowDown') {
        cat.sliding = true;
        cat.dy = cat.speed;
    } else if (event.code === 'Space' && cat.onGround) {
        cat.dy = cat.jumpPower;
        cat.onGround = false;
    } else if (event.code === 'KeyE') {
        handleItemPickupOrDrop();
    }
}

function handleKeyUp(event) {
    if (event.code === 'ArrowLeft' || event.code === 'ArrowRight') {
        cat.dx = 0;
    }
    if (event.code === 'ArrowDown') {
        cat.sliding = false;
        cat.dy = 0;
    }
}

function handleItemPickupOrDrop() {
    let heldItem = items.find(item => item.held);
    if (heldItem) {
        if (!checkPlacement(heldItem)) {
            heldItem.x = heldItem.originalX;
            heldItem.y = heldItem.originalY;
        }
        heldItem.held = false;
        heldItem.dy = 0;
    } else {
        items.forEach(item => {
            if (isColliding(cat, item)) {
                item.held = true;
                item.dy = 0;
            }
        });
    }
}

function handleTouchStart(event) {
    const touch = event.touches[0];
    const touchX = touch.clientX;
    const touchY = touch.clientY;

    if (touchX < canvas.width / 3) {
        cat.dx = -cat.speed;
    } else if (touchX > canvas.width * 2 / 3) {
        cat.dx = cat.speed;
    } else {
        if (cat.onGround) {
            cat.dy = cat.jumpPower;
            cat.onGround = false;
        }
    }
}

function handleTouchEnd() {
    cat.dx = 0;
    cat.dy = 0;
}

function gameLoop() {
    updateCat();
    updateItems();
    render();
    requestAnimationFrame(gameLoop);
}

window.addEventListener('keydown', handleKeyDown);
window.addEventListener('keyup', handleKeyUp);
canvas.addEventListener('touchstart', handleTouchStart);
canvas.addEventListener('touchend', handleTouchEnd);

gameLoop();
