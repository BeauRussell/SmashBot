const WebSocket = require('ws');
const request = require('request');
const getParser = require('@streammedev/parse-message');
const eachOfSeries = require('async/eachOfSeries');

const botKey = '3d2da48b-b7fc-4178-9db3-e19a6cdbecad';
const botSecret = '082e125617ad4d509b63ba1aac022373f0b933f3c19114b6';

const publicId = 'b18253c2-a588-4273-883c-83a19060ca3a';
const roomId = `user:${publicId}:web`;

const secondsInMS = 1000;
const minutesInMS = secondsInMS * 60;
const hoursInMS = minutesInMS * 60;
const daysInMS = hoursInMS * 24;
const monthsInMS = daysInMS * 30;
const yearsInMS = daysInMS * 365;

function botAuth (cb) {
	request({
		method: 'POST',
		url: 'https://www.stream.me/api-auth/v1/login-bot',
		body: {
			key: botKey,
			secret: botSecret
		},
		json: true
	}, function (err, res, body) {
		if (err) {
			console.log(err);
			return;
		}
		const botToken = body.access_token;
		cb(err, botToken);
	});
}

function retrieveUserSlug (cb) {
	request({
		url: `https://www.stream.me/api-user/v1/users/${publicId}/channel`,
		json: true
	}, function (err, res, body) {
		if (err) {
			console.log(err);
		}
		const userSlug = body.slug;
		cb(userSlug);
	});
}

getParser(roomId, function (err, parseMessage) {
	if (err) {
		console.log(err);
		return;
	}
	botAuth(function (err, token) {
		if (err) {
			console.log(err);
			return;
		}
		retrieveUserSlug(function (channelSlug) {
			openWS();

			const commands = {
				'!emotes': 'Upload your own emotes! https://www.stream.me/settings/chat',
				'!tableflip': '(╯°□°）╯︵ ┻━┻',
				'!tablefix': '┬──┬ ノ( ゜-゜ノ)',
				'!ws': 'I respect your warrior skills Frogger',
				'!commands': '!coinflip, !emotes, !followage, !frogger, !tablefix, !tableflip, !upcoming, !uptime',
				'!frogger': 'Frogger Frogger Frogger',
				'!upcoming': upcoming,
				'!followage': followAge,
				'!uptime': uptime,
				'!coinflip': coinflip
			};

			function parse (data) {
				const message = parseMessage(data);
				const chat = message.message;
				if (chat in commands) {
					responds(chat, message.actor.slug);
				}
			}

			function responds (key, userSlug) {
				if (typeof commands[key] === 'string') {
					sendMessage(commands[key]);
				} else {
					commands[key](userSlug);
				}
			}

			function upcoming(userSlug) {
				request({
					url: 'https://api.smash.gg/station_queue/57881',
					json: true
				}, function(err, res, body) {
					if (err) {
						console.log(err);
						return;
					}
					if (res.statusCode === 404) {
						sendMessage('The match queue for this week is not currently live.');
						return;
					}
					let upcomingMatches = body.data.entities.sets;
					if (upcomingMatches.length > 4) {
						upcomingMatches = upcomingMatches.slice(0,3);
					}
					if (!Array.isArray(upcomingMatches)) {
						sendMessage('This is currently the only match in the stream queue');
						return;
					}
					eachOfSeries(upcomingMatches, function(match, key, cb) {
						const index = key + 1;
						var matchString = 'Upcoming Match #' + index + ': ';
						request({
							url: `https://api.smash.gg/entrant/${match.entrant1Id}`,
							json: true
						}, function(err, res, body) {
							if (err) {
								console.log('Error accessing endpoint for match ' + key + ' entrantId' + match.entrant1Id);
								console.log(err);
								return cb();
							}
							if (res.statusCode === 404) {
								matchString += 'TBD vs. ';
							} else {
								matchString += body.entities.player[0].gamerTag + ' vs. ';
							}
							request({
								url: `https://api.smash.gg/entrant/${match.entrant2Id}`,
								json: true
							}, function(err, res, body) {
								if (err) {
									console.log('Error accessing endpoint for match ' + key + ' entrantId' + match.entrant2Id);
									console.log(err);
									return cb();
								}
								if (res.statusCode === 404) {
									matchString += 'TBD';
								} else {
									matchString += body.entities.player[0].gamerTag;
								}
								//TODO: rate limit this call so you don't hit the limit and lose messages
								sendMessage(matchString);
								cb();
							});
						});
					});
				});
			}

			function followAge (userSlug) {
				request({
					url: `https://www.stream.me/api-user/v2/${userSlug}/follow/${channelSlug}`,
					json: true
				}, function (err, res, body) {
					if (err) {
						console.log(err);
						return;
					}
					if (res.statusCode === 404) {
						sendMessage('@' + userSlug + ' is not following this channel.');
						return;
					}
					let followStart = new Date(body.created);
					followStart = Date.parse(followStart);
					const msFollow = Date.now() - followStart;
					const timing = formatTime(msFollow);
					sendMessage('@' + userSlug + ' has been following this channel for: ' + timing);
				});
			}

			function uptime (userSlug) {
				request({
					url: `https://www.stream.me/api-channel/v1/channels?publicIds=${publicId}`,
					json: true
				}, function (err, res, body) {
					if (err) {
						console.log(err);
						return;
					}
					const info = body[0].streams[0];
					if (info.active) {
						const msLive = Date.now() - info.lastStarted;
						const timing = formatTime(msLive);
						sendMessage('This channel has been live for: ' + timing);
					} else {
						sendMessage('This channel is not currently live.');
					}
				});
			}

			function coinflip (userSlug) {
				if (Math.random() > 0.5) {
					sendMessage('Heads!');
				} else {
					sendMessage('Tails!');
				}
			}

			function formatTime (time) {
				let message = '';
				const years = Math.floor(time / yearsInMS);
				time = time % yearsInMS;
				const months = Math.floor(time / monthsInMS);
				time = time % monthsInMS;
				const days = Math.floor(time / daysInMS);
				time = time % daysInMS;
				const hours = Math.floor(time / hoursInMS);
				time = time % hoursInMS;
				const minutes = Math.floor(time / minutesInMS);
				time = time % minutesInMS;
				const seconds = Math.floor(time / secondsInMS);
				if (years !== 0) {
					if (years === 1) {
						message += years + ' year ';
					} else {
						message += years + ' years ';
					}
				}
				if (months !== 0) {
					if (months === 1) {
						message += months + ' month ';
					} else {
						message += months + ' months ';
					}
				}
				if (days !== 0) {
					if (days === 1) {
						message += days + ' day ';
					} else {
						message += days + ' days ';
					}
				}
				if (hours !== 0) {
					if (hours === 1) {
						message += hours + ' hour ';
					} else {
						message += hours + ' hours ';
					}
				}
				if (minutes !== 0) {
					if (minutes === 1) {
						message += minutes + ' minute ';
					} else {
						message += minutes + ' minutes ';
					}
				}
				if (seconds !== 0) {
					if (seconds === 1) {
						message += seconds + ' second ';
					} else {
						message += seconds + ' seconds ';
					}
				}
				return message;
			}

			function sendMessage (sendMessage) {
				request({
					method: 'POST',
					url: `https://www.stream.me/api-commands/v1/room/${roomId}/command/say`,
					json: true,
					headers: {
						Authorization: `Bearer ${token}`
					},
					body: {
						message: sendMessage
					}
				}, function (err, res, body) {
					if (err) {
						console.log(err);
						return;
					}
					if (res.statusCode !== 200) {
						console.log(body);
					}
				});
			}

			function openWS () {
				var ws = new WebSocket('wss://www.stream.me/api-rooms/v3/ws');
				ws.on('open', function open () {
					ws.send(`chat {"action":"join","room":"${roomId}"}`);
				});

				ws.on('message', function (data, flags) {
					let spaceIndex = data.indexOf(' ');
					const nameSpace = data.slice(0, spaceIndex);
					let dataSlice = data.slice(spaceIndex + 1);
					if (nameSpace !== 'chat') {
						return;
					}
					spaceIndex = dataSlice.indexOf(' ');
					const messageType = dataSlice.slice(0, spaceIndex);
					dataSlice = dataSlice.slice(spaceIndex + 1);
					if (messageType !== 'message') {
						console.log(data);
						return;
					}

					const rawMessage = JSON.parse(dataSlice);

					if (rawMessage.action === 'join') {
						return;
					}
					if (rawMessage.type !== 'chat') {
						console.log('Unexpected message type: ' + rawMessage.type);
						return;
					}
					parse(rawMessage.data);
				});

				ws.on('close', function (reasonCode, description) {
					openWS();
				});
			}
		});
	});
});