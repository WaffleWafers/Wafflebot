var auth = require('./auth.json');
const Discord = require("discord.js");
const moment = require('moment');
const mongoose = require('mongoose');
const async = require('async');
const request = require('request');
const bot = new Discord.Client();

mongoose.Promise = global.Promise;
mongoose.connect('mongodb://localhost/wafflebot');
var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));

var reminderSchema = mongoose.Schema({
    authorId: String,
    message: String,
    time: Date
});

var Reminder = mongoose.model('Reminder', reminderSchema);

const commands = {
    '!help': {
        description: `Show list of all commands.`,
        isAdminCommand: false,
        availableByDM: true,
        expectedArgs: 0,
        run: function(msg, args) {
            let message = `**Command List**\n`;
            for (let key in commands) {
                if (!commands.hasOwnProperty(key)) continue;
                if (commands[key].isAdminCommand) continue;
                message += (`${key} ${commands[key].expectedArgs > 0 || commands[key].expectedArgs == -1 ? commands[key].argDescription : ''} - *${commands[key].description}*\n`);
            }
            msg.channel.sendMessage(message);
        }
    },
    '!username': {
        description: `Change name of bot. (2 hour cooldown)`,
        argDescription: `<username>`,
        isAdminCommand: true,
        availableByDM: true,
        expectedArgs: -1,
        run: function(msg, args) {
            if (args.length == 0) return;
            let username = args.join(' ');
            changeUsername(username);
        }
    },
    '!remindme': {
        description: `Reminds you with a PM.`,
        argDescription: `<int> <unit> <"message">`,
        isAdminCommand: false,
        availableByDM: true,
        expectedArgs: -1,
        run: function(msg, args) {
            let authorId = msg.author.id;
            if (!/"(.*)"/.test(msg.content)) return;
            let message = /"(.*)"/.exec(msg.content)[1];
            let time = /!remindme *([^"]*) /.exec(msg.content)[1];
            let reminderTime = processDate(time);
            if (reminderTime == null) return;
            var reminder = new Reminder({
                authorId: authorId,
                message: message,
                time: reminderTime
            });
            reminder.save(function(err, reminder) {
                if (err) {
                    msg.channel.sendMessage(`Oops! Something went wrong with saving your reminder on our end.`);
                    console.log(err);
                } else {
                    msg.channel.sendMessage(`Noted!`);
                }
            });
        }

    },
    '!clearreminders': {
        description: `Clears all saved reminders.`,
        isAdminCommand: true,
        availableByDM: true,
        expectedArgs: 0,
        run: function(msg, args) {
            Reminder.remove({}, function(err) {
                if (err) {
                    msg.channel.sendMessage(`Oop! Something went wrong with clearing the reminder collection.`);
                    console.log(err);
                } else {
                    console.log('Reminder collection removed');
                }
            });
        }
    },
    '!sendreminders': {
        description: `Sends all due reminders.`,
        isAdminCommand: true,
        availableByDM: true,
        expectedArgs: 0,
        run: function(msg, args) {
            sendReminders();
        }
    },
    '!strawpoll': {
        description: `Creates a strawpoll.`,
        argDescription: `<question> <[option1, option2, ...]>`,
        isAdminCommand: false,
        availableByDM: false,
        expectedArgs: -1,
        run: function(msg, args) {
            if (!/ \[(.*)\]/.test(msg.content)) return;
            let question = /!strawpoll ([^\[\]]*) /.exec(msg.content)[1];
            let options = / \[(.*)\]/.exec(msg.content)[1].split(',').map( (e) => { return e.trim(); } );
            if (options.length == 0 || question.length == 0) return;
            
            initStrawpoll(msg, question, options);
        }
    },
    '!purge': {
        description: `Deletes the past up to 99 messages sent or up to a certain message exclusive. (mods only)`,
        argDescription: `<int> or <message-id>`,
        isAdminCommand: false,
        availableByDM: false,
        expectedArgs: -1,
        run: function(msg, args) {
            if (!msg.guild.member(msg.author).hasPermission("MANAGE_MESSAGES")) return;

            let channel = msg.channel;

            let param = args[0];
            let isNumMessages = false;
            if (!isNaN(param) && param < 0) return;
            if (!isNaN(param) && param < 100) {
                isNumMessages = true;
                param = Number(param) + 1;
            } else if (!isNaN(param) && param < 10000000000000000) {
                msg.channel.sendMessage('You can only purge up to 99 messages at a time. Sorry!');
            } else {
                msg.channel.fetchMessage(param).then(
                    function(message) {
                        console.log(message.content);
                    },
                    function(reason) {
                        msg.channel.sendMessage('Unable to find message with the id: `' + param + '`');
                        return;
                    }
                )
            }

            let fetchQuery = isNumMessages ? {limit: param} : {limit: 100, after: param};
            
            channel.fetchMessages(fetchQuery).then(
                    function(messages) {
                        channel.bulkDelete(messages).catch(
                                function(reason) {
                                    // Probably because you can't delete messages 2 weeks or older.
                                    // Or you're trying to purge without permissions.
                                    console.log('Error purging messages: ' + reason);
                                }
                            )
                    },
                    function(reason) {
                        // You're trying to delete too many messages at once.
                        console.log('Error fetching messages to purge: ' + reason);
                    }
                );
        }
    },
    
};

bot.on("message", msg => {
    if (msg.author.bot) return;

    let args = msg.content.split(' ');
    let command = args.splice(0, 1).toString().toLowerCase();

    if (!(command in commands)) return;
    if (commands[command].expectedArgs != args.length && commands[command].expectedArgs != -1) return;
    if (commands[command].isAdminCommand && !auth.admins.includes(msg.author.id)) return;
    if (!commands[command].availableByDM && msg.channel.type === 'dm') return; 

    commands[command].run(msg, args);
});

function changeUsername(text){
    bot.user.setUsername(text)
        .then(user => console.log(`My new username is ${user.username}`))
        .catch(console.log('Your username change is probably on cooldown.'));
}

function changeAvatar(path){
    bot.user.setAvatar(path)
        .then(user => console.log(`New avatar set!`))
        .catch(console.error);
}

var sendReminders = function() {
    Reminder.find({
            time: { $lte: Date.now() }
        },
        function(err, reminders) {
            if (err) {
                console.log(`An error occurred while querying for reminders.`);
                return;
            }
            async.each(reminders, function(reminder) {
                if (!reminders) return;

                let userId = reminder.authorId;
                let message = reminder.message;
                let date = new Date(reminder.time);
                bot.users.get(userId).sendMessage(``, {embed: {
                    color: 3447003,
                    title: 'Reminder!',
                    description: message,
                    timestamp: date,
                }});
                console.log(`A reminder was sent!`);
                reminder.remove();
            });
        }
    );
}

function processDate(time) {
    let timeUnits = ['years', 'quarters', 'months', 'weeks', 'days', 'hours', 'minutes'];
    let processedDate = moment();
    let args = time.split(' ');

    if (args.length == 1) return;

    for (let i = 0 ; i < args.length - 1 ; i+=2){
        console.log(args[i] + " " + /[^s]*/.exec(args[i+1])[0] + 's');
        let number = args[i];
        if (isNaN(number)) return;
        if (number < 0) return;
        number = Number(number);

        let units = /[^s]*/.exec(args[i+1])[0] + 's';
        if (timeUnits.indexOf(units) > -1) {
            processedDate.add(number, units);
        } else {
            return;
        }
    }

    return processedDate.toDate();
}

function initStrawpoll(msg, question, options) {
    request.post('https://strawpoll.me/api/v2/polls', 
        {
            json: true,
            followAllRedirects: true,
            body: {
                "title": question,
                "options": options,
                "multi": false
            }
        }, function(error, response, body) {
            if (!error && response.statusCode == 200) {
                msg.channel.sendMessage('', {embed: {
                    color: 3447003,
                    title: 'POLL: ' + body.title,
                    description: 'http://strawpoll.me/' + body.id,
                    timestamp: new Date(),
                    footer: {
                        icon_url: msg.author.avatarURL,
                        text: 'Strawpoll created by ' + msg.author.username,
                    }
                }});
            } else {
                msg.channel.sendMessage("There was an error in making your strawpoll. Sorry!");
                console.log('some sort of failure: ' + response.statusCode);
                return;
            }
        }
    );
}


bot.on("ready", () => {
    console.log(`Ready to serve in ${bot.channels.size} channels on ${bot.guilds.size} servers, for a total of ${bot.users.size} users.`);
});

bot.login(auth.token).then(console.log('Logged in.')).catch(error => console.log(error));

setInterval(sendReminders, 60000);
