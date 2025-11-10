import { Client } from "mpp-client-net";
import * as Discord from "discord.js";
import * as dismoji from "discord-emoji";

let config = {
    mpp: {
        enableNameChanging: true,
        channel: "cheez"
    },
    discord: {
        channelID: "1426758857358704722",
    }
};

let state = {
    global: {

    },
    mpp: {
        muted: false,
        originalName: "",
        originalColor: ""
    },
    discord: {
        muted: false
    }
};

// MPP

const cl = new Client("wss://mppclone.com", process.env.MPPNET_TOKEN);

let oldChannel = "";
let lastChannelFix = Date.now();

function fixChannel() {
    if (lastChannelFix < Date.now() + 5000) return;
    lastChannelFix = Date.now();
    cl.setChannel(config.mpp.channel);
}

cl.start();
cl.setChannel(config.mpp.channel);

// Connection event
cl.on("hi", msg => {
    console.log(`Connected to MPP as ${msg.u._id}`);

    if (typeof msg.u === "object") {
        if (typeof msg.u.name === "string") {
            state.mpp.originalName = msg.u.name;
        }

        if (typeof msg.u.color === "string") {
            state.mpp.originalColor = msg.u.color;
        }
    }
});


// Channel event
cl.on("ch", msg => {
    if (msg.ch._id !== oldChannel) console.log(`Connected to channel ${msg.ch._id}`);
});

// Chat event
cl.on("a", async msg => {
    if (cl.channel._id !== config.mpp.channel)
        return fixChannel();

    if (msg.p._id === cl.getOwnParticipant()._id) return;

    //console.log(`${msg.p._id.substring(0, 6)} ${msg.p.name}: ${msg.a}`);

    // Send to cached Discord channel
    if (channel) await channel.send({
        content: `${msg.p._id.substring(0, 6)} ${msg.p.name}: ${msg.a}`,
        body: {
            allowed_mentions: {
                parse: []
            }
        }
    });
});

const mppCommandPrefix = "!bridge";

const mppCommands: Record<string, (args: string[]) => Promise<string>> = {
    mute: async () => {
        state.mpp.muted = true;
        return "Bridge mute enabled"
    },
    unmute: async () => {
        state.mpp.muted = false;
        return "Bridge mute disabled"
    },
    color: async args => {
        const color = args[1]
        if (!color) return "No color provided";
        if (!color.match(/^#[0-9a-f]{6}$/i)) return "Invalid color provided";
        cl.setColor(color);
        return `Changed color to ${args[1]}`;
    }
}

// Chat event (commands)
cl.on("a", async msg => {
    if (!msg.a.startsWith(mppCommandPrefix)) return;

    const args = msg.a.split(" ").slice(1);
    if (!args[0]) return;

    const cmd = args[0].toLowerCase();

    for (const key of Object.keys(mppCommands)) {
        if (cmd !== key) continue;

        const task = mppCommands[key];
        if (!task) continue;

        const output = await task(args);
        if (output) cl.sendChat(`[Bridge] \u034f${output}`);
    }
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

// stupid emoji translater
// ? context: essx sends emoji strangely so we have to de-convert it back to original chars
const emoji: Record<string, string> = {};

for (const kv of Object.values(dismoji)) {
    for (const key of Object.keys(kv)) {
        emoji[key] = (kv as Record<string, string>)[key] as string;
    }
}

// Discord connected event
dc.on("clientReady", async () => {
    console.log("Connected to Discord");


    // find desired text channel endpoint
    let ch = await dc.channels.fetch(config.discord.channelID);

    if (!ch) return console.warn("No Discord text channel found");
    if (ch.type == Discord.ChannelType.GuildText)
        channel = ch;
});

function handleMinecraftMessage(text: string) {
    // emoji thing
    for (const str of Object.keys(emoji)) {
        text = text.split(`:${str}:`).join(emoji[str]);
    }

    // detect username by split
    const delimiter = ": ";
    const chunks = text.split(delimiter);

    let name = chunks[0];
    let content = chunks.slice(1).join(delimiter);

    // has username?
    if (name && content) {
        name = name.split("\\").join("");

        // change name and send message content
        state.mpp.originalName = cl.getOwnParticipant().name;
        state.mpp.originalColor = cl.getOwnParticipant().color;

        cl.userset({
            name,
            color: "#ffffff"
        });

        return content;
    }

    return text;
}

// Discord chat message
dc.on("messageCreate", async msg => {
    if (msg.channelId !== config.discord.channelID) return;

    let message = "";

    // is the message from a webhook or user/bot?
    if (typeof msg.webhookId === "string") {
        message += handleMinecraftMessage(msg.cleanContent);
    } else {
        // message is likely from a normal user
        if (!msg.member) return;
        if (!dc.user) return console.debug("no discord user (self)");
        if (msg.member.id === dc.user.id) return;

        // can we change name?
        if (config.mpp.enableNameChanging) {
            // embed name and color into chat
            state.mpp.originalName = cl.getOwnParticipant().name;
            state.mpp.originalColor = cl.getOwnParticipant().color;

            cl.userset({
                name: `${msg.member.displayName}`,
                color: msg.member.displayHexColor
            });

            message += `${msg.content} ${msg.embeds.join(" ")}`;
        } else {
            message += `${msg.member.displayName}: ${msg.content} ${msg.embeds.join(" ")}`;
        }
    }

    // crappy fallback detection
    if (message !== "\u034f") {
        //console.debug(message);
        if (!state.mpp.muted) cl.sendChat(message);

        // revert mpp name
        if (config.mpp.enableNameChanging) {
            cl.userset({
                name: state.mpp.originalName,
                color: state.mpp.originalColor
            });
        }
    }
});

dc.login(process.env.DISCORD_TOKEN);
