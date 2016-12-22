var Discord = require("discord.js");
var bot = new Discord.Client();

let adminIds = ['89915430898012160'];
const botToken = 'MjQ2NDU0NTE3Njc4MjExMDcz.Cxffvw.V_O7T7Z_xfB3rETusRs31T7lW34';
const commands = {
  '!help': {
    description: `Show list of all commands.`,
    isAdminCommand: false,
    expectedArgs: 0,
    run: function(channel, args) {
      channel.sendMessage(`**Command List**`);
      for (var key in commands) {
        if (!commands.hasOwnProperty(key)) continue;
        if (commands[key].isAdminCommand) continue;
        channel.sendMessage(`${key} ${commands[key].expectedArgs > 0 || commands[key].expectedArgs == -1 ? commands[key].argDescription : ''} - *${commands[key].description}*`);
      }
    }
  },
  '!username': {
    description: `Change name of bot. (2 hour cooldown)`,
    argDescription: '<*username*>',
    isAdminCommand: true,
    expectedArgs: -1,
    run: function(channel, args) {
      if (args.length == 0) return;
      let username = args.join(' ');
      changeUsername(username);
    }
  }
};

bot.on("message", msg => {
  if (msg.author.bot) return;

  let args = msg.content.split(' ');
  let command = args.splice(0, 1);
  
  if (!(command in commands)) return;
  if (commands[command].expectedArgs != args.length && commands[command].expectedArgs != -1) return;
  if (commands[command].isAdminCommand == true && !adminIds.includes(msg.author.id)) return;

  commands[command].run(msg.channel, args);
});

function changeUsername(text){
  bot.user.setUsername(text)
    .then(user => console.log(`My new username is ${user.username}`))
    .catch(console.log('Your username change is probably on cooldown.'));
}

function changeAvatar(path){
  bot.user.setAvatar(path)
    .then(user => console.log(`New avatar set!`))
    .catch(console.error);;
}

bot.on("ready", () => {
  console.log(`Ready to serve in ${bot.channels.size} channels on ${bot.guilds.size} servers, for a total of ${bot.users.size} users.`);
});

bot.login(botToken);
