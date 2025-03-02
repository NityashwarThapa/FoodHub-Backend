const { initializeApp } = require("./server");

async function startServer() {
  try {
    const app = await initializeApp();

    const port = process.env.PORT || 8000;
    app.set("PORT", port);

    app.listen(port, () => {
      console.log(`App listening on port ${port}`);
    });
  } catch (error) {
    console.error("Error starting server:", error);
    process.exit(1);
  }
}

startServer();
