import React, { useEffect, useRef, useState } from 'react';
import Phaser from 'phaser';
import { navigate } from 'wouter/use-browser-location';

const MarioGame2: React.FC = () => {
    const gameContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!gameContainerRef.current) return;

        const config: Phaser.Types.Core.GameConfig = {
            type: Phaser.AUTO,
            width: 800,
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
        let goomba: Phaser.Physics.Arcade.Sprite;
        let goomba2: Phaser.Physics.Arcade.Sprite;
        let platforms: Phaser.Physics.Arcade.StaticGroup;
        let cursors: Phaser.Types.Input.Keyboard.CursorKeys | undefined;

        function preload(this: Phaser.Scene) {
            // Load assets
            this.load.image('sky', 'https://labs.phaser.io/assets/skies/space3.png');
            this.load.image('ground', 'https://labs.phaser.io/assets/platforms/grass-tile.png');
            this.load.image('star', 'https://labs.phaser.io/assets/sprites/star.png');
            this.load.image('flag', '/flag.png')
            this.load.spritesheet('mario', '/mario.png', {
                frameWidth: 40,
                frameHeight: 40,
            });
            this.load.spritesheet('imario', '/imario.png', {
                frameWidth: 40,
                frameHeight: 40,
            });
            this.load.spritesheet('goomba', '/goomba.png', {
                frameWidth: 40,
                frameHeight: 40,
            });
        }

        function create(this: Phaser.Scene) {
            // Focus the game canvas
            this.game.canvas.setAttribute('tabindex', '0');
            this.game.canvas.focus();

            // Enable keyboard input
            if (this.input.keyboard) {
                this.input.keyboard.enabled = true;
            }


            // Initialize cursors
            if (this.input.keyboard) {
                cursors = this.input.keyboard.createCursorKeys();
            } else {
                console.warn('Keyboard input not available.');
            }

            // Add background
            this.add.image(400, 300, 'sky');

            // Create platforms
            platforms = this.physics.add.staticGroup();
            platforms.create(100, 568, 'ground').setScale(2).refreshBody();
            platforms.create(225, 385, 'ground').refreshBody();
            platforms.create(155, 350, 'ground');
            platforms.create(430, 200, 'ground').setScale(0.65).refreshBody();
            platforms.create(350, 120, 'ground').setScale(0.5).refreshBody();
            platforms.create(530, 290, 'ground').setScale(0.05).refreshBody();
            platforms.create(750, 120, 'ground').setScale(0.30).refreshBody();

            //Create flag
            const flag = this.physics.add.sprite(750, 113, 'flag').setScale(0.5);
            flag.setOrigin(0.5, 1);
            flag.body.setAllowGravity(false);

            //create goombas
            goomba = this.physics.add.sprite(200, 460, 'goomba').setScale(0.75);
            goomba.setBounce(0.2);
            goomba.setCollideWorldBounds(true);

            goomba2 = this.physics.add.sprite(400, 100, 'goomba').setScale(1.2);
            goomba2.setBounce(0.2);
            goomba2.setCollideWorldBounds(true);
            goomba2.setTint(0xFF0000); // Bright red - unkillable

            // Create player
            player = this.physics.add.sprite(100, 450, 'mario');
            player.setBounce(0.2);
            player.setCollideWorldBounds(true);

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

            // Use a timed event to change direction every 2 seconds
            this.physics.world.once('worldstep', () => {
                goomba.setVelocityX(100); // Start moving right
            });

            // Use a timer to switch direction every 2 seconds
            this.time.addEvent({
                delay: 5000,
                loop: true,
                callback: () => {
                    if (goomba.body) { // Ensure body exists before modifying velocity
                        goomba.setVelocityX(goomba.body.velocity.x * -1);
                    }
                }
            });

            this.physics.world.once('worldstep', () => {
                goomba2.setVelocityX(20); // Start moving right
            });

            // Use a timer to switch direction every 2 seconds
            this.time.addEvent({
                delay: 3000,
                loop: true,
                callback: () => {
                    if (goomba2.body) { // Ensure body exists before modifying velocity
                        goomba2.setVelocityX(goomba2.body.velocity.x * -1);
                    }
                }
            });


            // Collide player with platforms
            this.physics.add.collider(player, platforms);

            // Collide goombas with platforms
            this.physics.add.collider(goomba, platforms);
            this.physics.add.collider(goomba2, platforms);

            player.setData('hasLost', false);
            player.setData('hasWon', false);




            // Detect collision between player and flag
            this.physics.add.overlap(player, flag, () => {
                if (!player.getData('hasLost') && !player.getData('hasWon')) {
                    // Freeze Mario
                    player.setData('hasWon', true);
                    player.setVelocity(0, 0);
                    player.anims.stop(); // Stop animations
                    player.setTint(0x00ff00); // Optional: Add a visual effect (e.g., tint Mario green)

                    // Display "Level Over" message
                    const levelOverText = this.add.text(400, 300, 'You won', {
                        fontSize: '48px',
                        color: '#ffffff',
                        fontFamily: 'Arial',
                    });
                    levelOverText.setOrigin(0.5, 0.5); // Center the text
                }
            });




            // Detect collision between player and goomba
            this.physics.add.overlap(player, goomba, () => {
                if (!player.getData('hasLost') && !player.getData('hasWon') && !goomba.getData('isDead')) {
                    const playerBottom = player.getBounds().bottom;
                    const goombaTop = goomba.getBounds().top;
                    const playerVelY = player.body?.velocity.y || 0;

                    // Check if Mario is landing on top of goomba
                    if (playerVelY > 0 && playerBottom < goombaTop + 20) {
                        // Kill the goomba
                        goomba.setData('isDead', true);
                        goomba.setTint(0x666666);
                        goomba.setAlpha(0.5);
                        (goomba.body as Phaser.Physics.Arcade.Body).enable = false;
                        // Give Mario a bounce
                        player.setVelocityY(-200);
                    } else {
                        // Mario dies
                        player.setData('hasLost', true);
                        player.setVelocity(0, 0);
                        player.anims.stop();
                        player.setTint(0xB22222);

                        const levelOverText = this.add.text(400, 300, 'Game Over', {
                            fontSize: '48px',
                            color: '#ffffff',
                            fontFamily: 'Arial',
                        });
                        levelOverText.setOrigin(0.5, 0.5);
                    }
                }
            });

            this.physics.add.overlap(player, goomba2, () => {
                if (!player.getData('hasLost') && !player.getData('hasWon')) {
                    const playerBottom = player.getBounds().bottom;
                    const goombaTop = goomba2.getBounds().top;
                    const playerVelY = player.body?.velocity.y || 0;

                    // Check if Mario is landing on top of goomba
                    if (playerVelY > 0 && playerBottom < goombaTop + 20) {
                        // Unkillable - just bounce Mario off
                        player.setVelocityY(-200);
                    } else {
                        // Mario dies
                        player.setData('hasLost', true);
                        player.setVelocity(0, 0);
                        player.anims.stop();
                        player.setTint(0xB22222);

                        const levelOverText = this.add.text(400, 300, 'Game Over', {
                            fontSize: '48px',
                            color: '#ffffff',
                            fontFamily: 'Arial',
                        });
                        levelOverText.setOrigin(0.5, 0.5);
                    }
                }
            });


        }


        function update(this: Phaser.Scene) {
            if (cursors && player.body) {
                // Debug logs
                console.log('Left:', cursors.left.isDown);
                console.log('Right:', cursors.right.isDown);
                console.log('Up:', cursors.up.isDown);
                console.log("tint:", player.isTinted)




                // Move Left
                if (cursors.left.isDown) {
                    player.setVelocityX(-160);
                    player.anims.play('left', true);
                }
                // Move Right
                else if (cursors.right.isDown) {
                    player.setVelocityX(160);
                    player.anims.play('right', true);
                }
                // Stop Moving
                else {
                    player.setVelocityX(0);
                }

                // Jump
                if (cursors.up.isDown && player.body.blocked.down) {
                    player.setVelocityY(-330);
                }
            }
        }

        // Cleanup game on component unmount
        return () => {
            game.destroy(true);
        };
    }, []);



    return (
        <div>
            <div className="background">
                <h1 className="text-container">AstroMario Game - Goomba Gap</h1>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
                <div ref={gameContainerRef}></div>
                <div>
                    <div style={{ textAlign: 'right', marginTop: '20px' }}>
                        <strong>Level 2: Goomba Gap</strong>
                    </div>
                    <div style={{ marginTop: '20px' }}>
                        <button className="button" onClick={() => navigate("game3")}>
                            <p className="p2">3rd level</p>
                        </button>
                    </div>
                </div>
            </div>


        </div>
    )



};

export default MarioGame2;