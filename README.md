# CommandFramework

A Minecraft Bedrock Edition Script API library for chat commands: typed,
validated parameters, nested subcommands, per-command permission tags, and
auto-generated usage/help messages - all off `world.beforeEvents.chatSend`,
no vanilla `/`-command registration required.

## Quick start

```js
import { CommandRegistry } from './Command/CommandRegistry.js';

const commands = new CommandRegistry({ prefix: '.' });

commands.register({
    name: 'heal',
    description: 'Heals a player.',
    params: [
        { name: 'target', type: 'player' },
        { name: 'amount', type: 'int', default: 20 },
    ],
    requiresTag: 'admin',
    execute: (ctx, args) => {
        args.target.runCommand(`effect @s instant_health 1 ${args.amount}`);
        ctx.sender.sendMessage(`§aHealed ${args.target.name}.`);
    },
});
```

Typing `.heal Steve 10` in chat parses `target` as a `Player` and `amount` as
`10`; `.heal Steve` uses the default `20`. A `help` command listing every
registered top-level command is added automatically (`registerHelpCommand: false`
to opt out).

See `scripts/main.js` for more complete examples, including subcommands,
relative coordinates, and a custom argument type.

## Command definition shape

```ts
{
  name: string,
  aliases?: string[],
  description?: string,
  requiresTag?: string,        // player.hasTag(tag) required to run
  params?: Param[],            // for leaf commands
  subcommands?: CommandDef[],  // for command groups
  execute?: (ctx, args) => void,
}
```

A command needs either `params`/`execute` (a leaf command) or `subcommands`
(a group). Groups route the next token to a matching subcommand by name or
alias; an optional `execute` on a group runs when it's called with no
subcommand at all.

### Params

```ts
{ name: string, type: string, default?: any, choices?: any[] }
```

- Omitting `default` makes the param required.
- `choices` validates the *parsed* value against a fixed set.
- Quoted arguments (`"North Base"`) are parsed as a single token.

### Built-in argument types

| type       | consumes  | notes |
|------------|-----------|-------|
| `string`   | 1 token   | passed through as-is |
| `int`      | 1 token   | must be a whole number |
| `float`    | 1 token   | any number |
| `boolean`  | 1 token   | `true/false`, `yes/no`, `on/off`, `1/0` |
| `player`   | 1 token   | matched by name (case-insensitive) against online players |
| `location` | 3 tokens  | `x y z`; each axis accepts `~` / `~N` relative to the sender, like vanilla selectors |

### Custom argument types

```js
commands.registerArgumentType('hex', (token) => {
    if (!/^[0-9a-f]{6}$/i.test(token)) throw new Error(`"${token}" is not a 6-digit hex color.`);
    return token;
});
```

Registered types are usable in any command's `params` afterward the same way
built-in types are.

## Limitations

- No tab-completion / vanilla command registration - this only intercepts
  chat messages starting with the configured prefix.
- `location` only supports the three-axis `x y z` / `~` form, not full
  selector syntax (`@a`, `@e[...]`, etc.).
- One player can only be resolved by exact (case-insensitive) name match;
  there's no partial-match or selector support for the `player` type.

## License

MIT - see [LICENSE](LICENSE).
