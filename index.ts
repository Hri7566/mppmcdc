import { Client } from "mpp-client-net";
import * as Discord from "discord.js";
import * as dismoji from "discord-emoji";

let config = {
    mpp: {
        enableNameChanging: false,
        channel: "cheez"
    },
    discord: {
        channelID: "1426758857358704722",
    }
};

// MPP

const cl = new Client("wss://mppclone.com", process.env.MPPNET_TOKEN);
let oldChannel = "";

cl.start();
cl.setChannel(config.mpp.channel);

cl.on("hi", msg => {
    console.log("Connected to MPP");
});

cl.on("ch", msg => {
    if (msg.ch._id !== oldChannel) console.log(`Connected to channel ${msg.ch._id}`);
})

cl.on("a", async msg => {
    if (cl.channel._id !== config.mpp.channel)
        return void cl.setChannel(config.mpp.channel);

    if (msg.p._id === cl.getOwnParticipant()._id && msg.a.startsWith("\u034f")) return;

    console.log(`${msg.p._id.substring(0, 6)} ${msg.p.name}: ${msg.a}`);

    if (channel) await channel.send({
        content: `[MPP] ${msg.p._id.substring(0, 6)} ${msg.p.name}: ${msg.a}`,
        body: {
            allowed_mentions: {
                parse: []
            }
        }
    });
});

// Discord w/ Minecraft messages

const dc = new Discord.Client({
    intents: [
        "Guilds",
        "GuildMessages",
        "GuildMessageTyping",
        "GuildMembers",
        "MessageContent",
    ]
});

let channel: Discord.TextChannel | null;

const emoji: Record<string, string> = {};

for (const kv of Object.values(dismoji)) {
    for (const key of Object.keys(kv)) {
        emoji[key] = (kv as Record<string, string>)[key] as string;
    }
}

dc.on("clientReady", async () => {
    console.log("Connected to Discord");

    let ch = await dc.channels.fetch(config.discord.channelID);

    if (!ch) return console.warn("No Discord text channel found");
    if (ch.type == Discord.ChannelType.GuildText) channel = ch;
});

dc.on("messageCreate", async msg => {
    if (msg.channelId !== config.discord.channelID) return;

    let message = "\u034f";

    // webhook or user/bot?
    if (typeof msg.webhookId === "string") {
        //const webhook = await msg.fetchWebhook();
        message += `[MC] ${msg.cleanContent}`;
    } else {
        if (!msg.member) return;
        if (!dc.user) return console.debug("no discord user (self)");
        if (msg.member.id === dc.user.id) return;

        message += `[D] ${msg.member.displayName}: ${msg.content}`;
    }

    if (message !== "\u034f") {
        for (const str of Object.keys(emoji)) {
            message = message.split(`:${str}:`).join(emoji[str]);
        }

        console.debug(message);
        cl.sendChat(message);
    }
});

dc.login(process.env.DISCORD_TOKEN);
