var auth = require('./auth.json');
const Discord = require("discord.js");
const moment = require('moment');
const mongo = require('mongodb');
const assert = require('assert');
const bot = new Discord.Client();

var MongoClient = mongo.MongoClient;
var url = 'mongodb://localhost:27017/reminderdb';

MongoClient.connect(url, (err, db) =>{
    assert.equal(null, err);

});

const commands = {
    '!help': {
        description: `Show list of all commands.`,
        isAdminCommand: false,
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
        argDescription: `<*username*>`,
        isAdminCommand: true,
        expectedArgs: -1,
        run: function(msg, args) {
            if (args.length == 0) return;
            let username = args.join(' ');
            changeUsername(username);
        }
    },
    '!remindme': {
        description: `Sets the bot to message you with a reminder when specified.`,
        argDescription: `<*time from now*> <*"message"*>`,
        isAdminCommand: false,
        expectedArgs: -1,
        run: function(msg, args) {
            let authorId = msg.author.id;
            if (!/"(.*)"/.test(msg.content)) return;
            let message = /"(.*)"/.exec(msg.content)[1];
            let reminderTime = new Date(msg.createdAt);
            reminderTime.setTime(reminderTime.getTime() + 60 * 1000);
            var reminder = {
                authorId: authorId,
                message: message,
                time: reminderTime
            }
            console.dir(reminder);
        }
    }
};

bot.on("message", msg => {
    if (msg.author.bot) return;

    let args = msg.content.split(' ');
    let command = args.splice(0, 1).toString().toLowerCase();

    if (!(command in commands)) return;
    if (commands[command].expectedArgs != args.length && commands[command].expectedArgs != -1) return;
    if (commands[command].isAdminCommand == true && !auth.admins.includes(msg.author.id)) return;

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

bot.on("ready", () => {
    console.log(`Ready to serve in ${bot.channels.size} channels on ${bot.guilds.size} servers, for a total of ${bot.users.size} users.`);
});

bot.login(auth.token).then(console.log('Logged in.')).catch(error => console.log(error));;
