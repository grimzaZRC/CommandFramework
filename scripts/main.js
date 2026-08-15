import { CommandRegistry } from './Command/CommandRegistry.js';

const commands = new CommandRegistry({ prefix: '.' });

// Leaf command with a required arg, an optional arg with a default, and choices.
commands.register({
    name: 'place',
    aliases: ['ps'],
    description: 'Places the loaded structure at your feet.',
    params: [
        { name: 'rotation', type: 'int', default: 0, choices: [0, 90, 180, 270] },
        { name: 'mirror', type: 'string', default: 'none', choices: ['none', 'x', 'z'] },
    ],
    execute: (ctx, args) => {
        ctx.sender.sendMessage(`§ePlacing at rotation ${args.rotation}, mirror ${args.mirror}...`);
        // e.g. schematic.place(ctx.dimension, ctx.location, { rotation: args.rotation, mirror: args.mirror });
    },
});

// Command group with subcommands, each with its own params and permission.
commands.register({
    name: 'claim',
    description: 'Manage land claims.',
    subcommands: [
        {
            name: 'create',
            params: [{ name: 'claimName', type: 'string' }],
            execute: (ctx, args) => {
                ctx.sender.sendMessage(`§aCreated claim "${args.claimName}" at your location.`);
            },
        },
        {
            name: 'delete',
            requiresTag: 'admin',
            params: [{ name: 'claimName', type: 'string' }],
            execute: (ctx, args) => {
                ctx.sender.sendMessage(`§cDeleted claim "${args.claimName}".`);
            },
        },
    ],
});

// player + location argument types, and a relative-coordinate example (~5 ~ ~-3).
commands.register({
    name: 'teleport',
    aliases: ['tp'],
    description: 'Teleports a player to a location.',
    params: [
        { name: 'target', type: 'player' },
        { name: 'destination', type: 'location' },
    ],
    execute: (ctx, args) => {
        args.target.teleport(args.destination);
        ctx.sender.sendMessage(`§aTeleported ${args.target.name}.`);
    },
});

// Custom argument type, registered once and reusable across any command.
commands.registerArgumentType('hex', (token) => {
    if (!/^[0-9a-f]{6}$/i.test(token)) {
        throw new Error(`"${token}" is not a 6-digit hex color.`);
    }
    return token;
});
