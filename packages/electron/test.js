const { Server, ServerEvent } = require("socket-be");

const port = 3000; // Default port for the server

const server = new Server({ port, disableEncryption: true });


server.once(ServerEvent.Open, ev => {
    console.log(`Server is open on port ${port}`);

})
server.once(ServerEvent.WorldInitialize, async (ev) => {
    const world = ev.world;
    console.log(`world initialized: ${world.name}`);
    localPlayer = await world.getLocalPlayer();
});