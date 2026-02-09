import React, { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { navigate } from 'wouter/use-browser-location';
import { useLevelCompletion } from '../context/LevelCompletionContext';
import LevelFooter from './LevelFooter';

const MarioGame14: React.FC = () => {
    const gameContainerRef = useRef<HTMLDivElement>(null);
    const { markLevelComplete } = useLevelCompletion();
    const onWinRef = useRef(() => markLevelComplete(14));
    onWinRef.current = () => markLevelComplete(14);

    // R key to reload
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'r' || e.key === 'R') {
                window.location.reload();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    useEffect(() => {
        if (!gameContainerRef.current) return;

        const config: Phaser.Types.Core.GameConfig = {
            type: Phaser.AUTO,
            width: 1200,
            height: 600,
            parent: gameContainerRef.current,
            physics: {
                default: 'arcade',
                arcade: {
                    gravity: { x: 0, y: 300 },
                    debug: false,
                },
            },
            scene: {
                preload: preload,
                create: create,
                update: update,
            },
        };

        const game = new Phaser.Game(config);

        let player: Phaser.Physics.Arcade.Sprite;
        let platforms: Phaser.Physics.Arcade.StaticGroup;
        let cursors: Phaser.Types.Input.Keyboard.CursorKeys | undefined;
        let darkOverlay: Phaser.GameObjects.Graphics;

        // WASD keys
        let keyW: Phaser.Input.Keyboard.Key | undefined;
        let keyA: Phaser.Input.Keyboard.Key | undefined;
        let keyD: Phaser.Input.Keyboard.Key | undefined;

        // Turrets and projectiles
        interface Turret {
            sprite: Phaser.GameObjects.Container;
            x: number;
            y: number;
            lastFireTime: number;
            fireRate: number;
            direction: number;
            warningSprite?: Phaser.GameObjects.Ellipse;
        }
        let turrets: Turret[] = [];
        let projectiles: Phaser.Physics.Arcade.Sprite[] = [];

        const VISIBILITY_RADIUS = 150;
        const PROJECTILE_SPEED = 250;

        function preload(this: Phaser.Scene) {
            this.load.image('sky', 'https://labs.phaser.io/assets/skies/space3.png');
            this.load.image('ground', 'https://labs.phaser.io/assets/platforms/grass-tile.png');
            this.load.image('flag', '/flag.png');
            this.load.spritesheet('mario', '/mario.png', {
                frameWidth: 40,
                frameHeight: 40,
            });
            this.load.spritesheet('imario', '/imario.png', {
                frameWidth: 40,
                frameHeight: 40,
            });
        }

        function create(this: Phaser.Scene) {
            this.game.canvas.setAttribute('tabindex', '0');
            this.game.canvas.focus();

            if (this.input.keyboard) {
                this.input.keyboard.enabled = true;
                cursors = this.input.keyboard.createCursorKeys();
                keyW = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
                keyA = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
                keyD = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
            }

            // Add background
            const bg = this.add.image(600, 300, 'sky');
            bg.setDisplaySize(1200, 600);

            // Create static platforms
            platforms = this.physics.add.staticGroup();

            // Starting platform (square block on left side)
            platforms.create(50, 568, 'ground').setScale(2).refreshBody();

            // Platforms spread across level
            platforms.create(200, 480, 'ground').setScale(0.4, 0.15).refreshBody();
            platforms.create(500, 420, 'ground').setScale(0.4, 0.15).refreshBody();
            platforms.create(800, 350, 'ground').setScale(0.4, 0.15).refreshBody();
            platforms.create(300, 300, 'ground').setScale(0.4, 0.15).refreshBody();
            platforms.create(600, 250, 'ground').setScale(0.4, 0.15).refreshBody();
            platforms.create(950, 200, 'ground').setScale(0.4, 0.15).refreshBody();
            platforms.create(400, 150, 'ground').setScale(0.4, 0.15).refreshBody();

            // Flag platform
            platforms.create(1100, 120, 'ground').setScale(0.3, 0.15).refreshBody();

            // Create turrets
            createTurret(this, 450, 390, -1, 2500);
            createTurret(this, 850, 320, -1, 2000);
            createTurret(this, 250, 270, 1, 3000);

            // Create flag
            const flag = this.physics.add.sprite(1100, 100, 'flag').setScale(0.15);
            flag.setOrigin(0.5, 1);
            (flag.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);

            // Create player on starting block
            player = this.physics.add.sprite(50, 480, 'mario');
            player.setBounce(0.1);
            player.setCollideWorldBounds(true);
            // @ts-ignore
            (player.body as any).onWorldBounds = true;
            player.setData('hasLost', false);
            player.setData('hasWon', false);

            // Player animations
            this.anims.create({
                key: 'left',
                frames: this.anims.generateFrameNumbers('imario', { start: 0, end: 1 }),
                frameRate: 10,
                repeat: -1,
            });

            this.anims.create({
                key: 'right',
                frames: this.anims.generateFrameNumbers('mario', { start: 0, end: 1 }),
                frameRate: 10,
                repeat: -1,
            });

            // Colliders
            this.physics.add.collider(player, platforms);

            // Flag overlap
            this.physics.add.overlap(player, flag, () => {
                if (!player.getData('hasLost') && !player.getData('hasWon')) {
                    player.setData('hasWon', true);
                    onWinRef.current();
                    player.setVelocity(0, 0);
                    player.anims.stop();
                    player.setTint(0x00ff00);
                    darkOverlay.setVisible(false);
                    this.add.text(600, 300, 'You Won!', {
                        fontSize: '48px',
                        color: '#ffffff',
                        fontFamily: 'Arial',
                    }).setOrigin(0.5, 0.5);
                }
            });

            // Death on hitting floor
            this.physics.world.on(
                'worldbounds',
                (body: Phaser.Physics.Arcade.Body, up: boolean, down: boolean) => {
                    if (body.gameObject === player && down) {
                        if (!player.getData('hasLost') && !player.getData('hasWon')) {
                            player.setData('hasLost', true);
                            player.setTint(0xB22222);
                            this.add.text(600, 300, 'Game Over', {
                                fontSize: '48px',
                                color: '#ffffff',
                                fontFamily: 'Arial',
                            }).setOrigin(0.5, 0.5);
                        }
                    }
                }
            );

            // Create the dark overlay
            darkOverlay = this.add.graphics();
            darkOverlay.setDepth(100);

            // Add hint text
            const hintText = this.add.text(600, 30, 'Navigate through the darkness! Watch for turret warning lights!', {
                fontSize: '16px',
                color: '#ffcc00',
                fontFamily: 'Arial',
            }).setOrigin(0.5, 0.5);
            hintText.setDepth(102);
        }

        function createTurret(scene: Phaser.Scene, x: number, y: number, direction: number, fireRate: number) {
            const container = scene.add.container(x, y);

            const base = scene.add.rectangle(0, 0, 30, 20, 0x444444);
            container.add(base);

            const barrel = scene.add.rectangle(direction * 15, 0, 20, 8, 0x666666);
            container.add(barrel);

            const warning = scene.add.ellipse(0, -15, 10, 10, 0xff0000, 0.3);
            container.add(warning);

            turrets.push({
                sprite: container,
                x: x,
                y: y,
                lastFireTime: scene.time.now + Math.random() * fireRate,
                fireRate: fireRate,
                direction: direction,
                warningSprite: warning,
            });
        }

        function fireProjectile(scene: Phaser.Scene, turret: Turret) {
            const projectile = scene.physics.add.sprite(
                turret.x + turret.direction * 25,
                turret.y,
                'ground'
            );
            projectile.setScale(0.08, 0.08);
            projectile.setTint(0xFF4444);
            (projectile.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
            projectile.setVelocityX(PROJECTILE_SPEED * turret.direction);
            projectiles.push(projectile);

            scene.physics.add.overlap(player, projectile, () => {
                if (!player.getData('hasLost') && !player.getData('hasWon')) {
                    player.setData('hasLost', true);
                    player.setTint(0xB22222);
                    scene.add.text(600, 300, 'Game Over!', {
                        fontSize: '48px',
                        color: '#ffffff',
                        fontFamily: 'Arial',
                    }).setOrigin(0.5, 0.5);
                }
            });
        }

        function update(this: Phaser.Scene) {
            if (!player.body) return;

            const currentTime = this.time.now;

            // Update fog of war - dark everywhere except circle around player
            if (!player.getData('hasWon')) {
                darkOverlay.clear();
                darkOverlay.fillStyle(0x000000, 0.92);

                // Draw 4 rectangles around the circle to create the darkness
                // This leaves a clear circular hole where the player is
                const cx = player.x;
                const cy = player.y;
                const r = VISIBILITY_RADIUS;

                // Top rectangle (above the circle)
                darkOverlay.fillRect(0, 0, 1200, cy - r);
                // Bottom rectangle (below the circle)
                darkOverlay.fillRect(0, cy + r, 1200, 600 - (cy + r));
                // Left rectangle (left of circle, between top and bottom)
                darkOverlay.fillRect(0, cy - r, cx - r, r * 2);
                // Right rectangle (right of circle, between top and bottom)
                darkOverlay.fillRect(cx + r, cy - r, 1200 - (cx + r), r * 2);

                // Fill in the corners with arc segments to make it circular
                // We draw the 4 corner rectangles and then "carve out" the circle by drawing dark around it
                darkOverlay.beginPath();
                darkOverlay.moveTo(cx - r, cy - r);
                darkOverlay.lineTo(cx, cy - r);
                darkOverlay.arc(cx, cy, r, -Math.PI / 2, -Math.PI, true);
                darkOverlay.closePath();
                darkOverlay.fillPath();

                darkOverlay.beginPath();
                darkOverlay.moveTo(cx + r, cy - r);
                darkOverlay.lineTo(cx, cy - r);
                darkOverlay.arc(cx, cy, r, -Math.PI / 2, 0, false);
                darkOverlay.closePath();
                darkOverlay.fillPath();

                darkOverlay.beginPath();
                darkOverlay.moveTo(cx - r, cy + r);
                darkOverlay.lineTo(cx, cy + r);
                darkOverlay.arc(cx, cy, r, Math.PI / 2, Math.PI, false);
                darkOverlay.closePath();
                darkOverlay.fillPath();

                darkOverlay.beginPath();
                darkOverlay.moveTo(cx + r, cy + r);
                darkOverlay.lineTo(cx, cy + r);
                darkOverlay.arc(cx, cy, r, Math.PI / 2, 0, true);
                darkOverlay.closePath();
                darkOverlay.fillPath();
            }

            // Update turrets
            turrets.forEach(turret => {
                const timeUntilFire = turret.lastFireTime + turret.fireRate - currentTime;

                if (timeUntilFire < 1000 && timeUntilFire > 0) {
                    const intensity = 1 - (timeUntilFire / 1000);
                    turret.warningSprite?.setFillStyle(0xff0000, 0.3 + intensity * 0.7);
                    const pulse = Math.sin(currentTime / 50) * 0.3 + 0.7;
                    turret.warningSprite?.setScale(pulse);
                } else {
                    turret.warningSprite?.setFillStyle(0xff0000, 0.3);
                    turret.warningSprite?.setScale(1);
                }

                if (currentTime > turret.lastFireTime + turret.fireRate) {
                    fireProjectile(this, turret);
                    turret.lastFireTime = currentTime;
                }
            });

            // Update projectiles
            projectiles = projectiles.filter(projectile => {
                if (projectile.x < -50 || projectile.x > 1250) {
                    projectile.destroy();
                    return false;
                }
                return true;
            });

            // Player movement - allow even after death
            if (cursors && !player.getData('hasWon')) {
                if (cursors.left.isDown || keyA?.isDown) {
                    player.setVelocityX(-180);
                    player.anims.play('left', true);
                } else if (cursors.right.isDown || keyD?.isDown) {
                    player.setVelocityX(180);
                    player.anims.play('right', true);
                } else {
                    player.setVelocityX(0);
                }

                if ((cursors.up.isDown || keyW?.isDown) && player.body.blocked.down) {
                    player.setVelocityY(-350);
                }
            }
        }

        return () => {
            game.destroy(true);
        };
    }, []);

    return (
        <div>
            <div className="background">
                <h1 className="text-container">AstroMario Game - Level 14</h1>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                <div ref={gameContainerRef}></div>
                <div>
                    <div style={{ textAlign: 'right', marginTop: '20px' }}>
                        <strong>Level 14: Infiltration</strong>
                    </div>
                    <div style={{ marginTop: '20px' }}>
                        <button className="button" onClick={() => navigate('game15')}>
                            <p className="p2">15th level</p>
                        </button>
                        <div style={{ textAlign: "right", marginTop: "10px", color: "#aaa", fontSize: "14px" }}>Press R to restart level</div>
                    </div>
                </div>
            </div>
            <LevelFooter />
        </div>
    );
};

export default MarioGame14;
