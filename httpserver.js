"use strict";

const net = require("net");
const fs = require("fs");
const path = require("path");
const yargs = require("yargs");
const OS = require("os");

OS.platform();

const argv = yargs
  .usage("node httpserver.js [--port port]")
  .default("port", 3000)
  .help("help").argv;

const ROOT_DIR = process.cwd(); // Replace with the directory where your files are located

let concurrency = [];
let nextInQueue = [];
let currentlyProcessing = "";

const handleClient = (socket) => {
  const id = Date.now();
  socket.id = id;
  concurrency.unshift(id);
  console.log("Current concurrency - ", concurrency);
  if (concurrency.length > 1) {
    nextInQueue = [...nextInQueue, id];
    let currentTimeout = 0;
    console.log(currentlyProcessing)
    while (currentTimeout != 250) {
      currentTimeout++;
    }
    currentlyProcessing = nextInQueue[0];
  } else currentlyProcessing = id;
  console.log("Currently processing: ", currentlyProcessing);
  socket
    .on("data", (data) => {
      const request = data.toString();
      const jsonRequest = JSON.parse(request);
      console.log("Request to ", jsonRequest);
      if (jsonRequest["method"].toUpperCase() === "GET") {
        if (jsonRequest["path"] === "/") {
          //default GET - returns all the list of files in the cwd

          fs.readdir(ROOT_DIR, (err, files) => {
            if (err) {
              const response = "HTTP/1.1 500 Internal Server Error";
              socket.write(response);
              socket.end();
            } else {
              const fileList = files.join("\n");
              let obj = jsonRequest.headers
                ? jsonRequest.headers
                : {
                  "Content-Type": "text/plain",
                  "Content-Disposition": "inline"
                };
              let res = "";
              for (const k in obj) res += k + ":" + obj[k] + "\n";
              res = res.trim();

              const response = JSON.stringify({
                data: `HTTP/1.1 200 OK\r\n${res}\r\n\r\n${fileList}`,
                opt: obj
              });
              socket.write(response);
              socket.end();
            }
          });
        } else {
          //GET - returns the content of the file
          // const filePath = path.join(ROOT_DIR, jsonRequest['path'] );
          let filePath;
          if (
            OS.platform() === "win32" &&
            jsonRequest["path"].split(":").length >= 2
          ) {
            //drive
            const response = JSON.stringify(
              {
                data: "HTTP/1.1 401 Unathorized \nInsufficient access to read from current directory",
                opt: {
                  "Content-Type": "text/plain",
                  "Content-Disposition": "inline"
                }
              });
            socket.write(response);
            return socket.end();
          } else if (
            (OS.platform() === "linux" || OS.platform() === "android") &&
            path.isAbsolute(jsonRequest["path"])
          ) {
            const response = JSON.stringify(
              {
                data: "HTTP/1.1 401 Unathorized \nInsufficient access to read from current directory",
                opt: {
                  "Content-Type": "text/plain",
                  "Content-Disposition": "inline"
                }
              });
            socket.write(response);
            return socket.end();
          } else filePath = "." + jsonRequest["path"];

          try {
            const content = fs.readFileSync(filePath);

            // File found, serve it
            var response = "";
            const options = generateContentType(content, filePath.split("."));
            if (content.length === 0)
              //Check if File is empty
              response = `HTTP/1.1 404 File is Empty\r\n\r\n${content}`;
            else {
              if (options.type === "image" || options.type === "video" || options.type === "pdf") {
                socket.write(content);
                return socket.end();
              }

              response = "HTTP/1.1 200 OK\n";
              for (const k in options) {
                if (k !== "type")
                  response += k + ":" + options[k] + "\n";
              }
              response += "\n";
              response += content;
            }
            const buffer = Buffer.from(JSON.stringify({ data: response, opt: options }));
            socket.write(buffer);
            socket.end();
          } catch (err) {
            // File not found
            const response = JSON.stringify(
              {
                data : "HTTP/1.1 404 Not Found\n\r\nFile not found",
                opt: {
                  "Content-Type": "text/plain",
                  "Content-Disposition" : "inline"
                }
              }
            );
              
            socket.write(response);
            socket.end()
          }
        }
      } else if (jsonRequest["method"].toUpperCase() === "POST") {
        if (jsonRequest["path"][0] === "/")
          jsonRequest["path"] = jsonRequest["path"].substr(1);
        let filePath;

        if (
          OS.platform() === "win32" &&
          jsonRequest["path"].split(":").length >= 2
        ) {
          //drive
          const response = JSON.stringify(
            {
              data: "HTTP/1.1 401 Unathorized \nInsufficient access to read from current directory",
              opt: {
                "Content-Type": "text/plain",
                "Content-Disposition": "inline"
              }
            });
          socket.write(response);
          return socket.end();
        } else if (
          (OS.platform() === "linux" || OS.platform() === "android") &&
          path.isAbsolute(jsonRequest["path"])
        ) {
          const response = JSON.stringify(
            {
              data: "HTTP/1.1 401 Unathorized \nInsufficient access to read from current directory",
              opt: {
                "Content-Type": "text/plain",
                "Content-Disposition": "inline"
              }
            });
          socket.write(response);
          return socket.end();
        } else filePath = jsonRequest["path"];
        // Extract the file path from the request path
        const content = jsonRequest["content"];

        // Write the data from the POST request to the file
        fs.writeFileSync(filePath, content);
        try {
          var response = "";
          if (
            jsonRequest["flag"] === "overwrite" &&
            jsonRequest["flagValue"]
          )
            response = JSON.stringify({

              data: `HTTP/1.1 200 OK\r\n ${jsonRequest["headers"] || "Content-Type:" + "text/plain" + "\r\n\r\nFile Overwritten Successfully"}`,
              opt: {
                "Content-Type": "text/plain",
                "Content-Disposition": "inline"
              }
            });

          else if (content !== "")
            response = JSON.stringify({

              data: `HTTP/1.1 200 OK\r\n ${jsonRequest["headers"] || "Content-Type:" + "text/plain" + "\r\n\r\nFile Created Successfully"}`,
              opt: {
                "Content-Type": "text/plain",
                "Content-Disposition": "inline"
              }
            });
          else
            response = JSON.stringify({

              data: `HTTP/1.1 200 OK\r\n ${jsonRequest["headers"] || "Content-Type:" + "text/plain" + "\r\n\r\nNew File Created Successfully"}`,
              opt: {
                "Content-Type": "text/plain",
                "Content-Disposition": "inline"
              }
            });
          socket.write(response);
        } catch (err) {
          // Handle any errors (e.g., permission issues)
          const response =
            "HTTP/1.1 500 Internal Server Error\r\nContent-Type: text/plain\r\n\r\nServer Error";
          socket.write(response);
        }
        socket.end();
      } else {
        // Unsupported HTTP method
        const response =
          "HTTP/1.1 501 Not Implemented\r\nContent-Type: text/plain\r\n\r\nMethod not supported";
        socket.write(response);
        socket.end();
      }

      concurrency = concurrency.slice(0, concurrency.length - 2);
      currentlyProcessing = "";
      nextInQueue = nextInQueue.slice(1)
    })

    .on("error", (err) => {
      socket.destroy();
    })
    .on("end", () => {
      socket.destroy();
    });
};

const server = net.createServer(handleClient).on("error", (err) => {
  throw err;
});

server.listen({ port: argv.port }, () => {
  console.log("HTTP server is listening at %j", server.address());
});

const generateContentType = (content, fileType) => {
  fileType = fileType[fileType.length - 1];
  try {
    if (fileType === "html" || fileType === "css" || fileType === "xsl" || fileType === "csv") {
      return {
        "Content-Type": `text/${fileType};`,
        "Content-Disposition": "inline",
        "type": "text"
      }
    }

    if (fileType === "jpeg" || fileType === "jpg" || fileType === "png" || fileType === "gif") {
      return {
        "Content-Type": `image/${fileType};`,
        "Content-Disposition": "attachment",
        "type": "image"
      }
    } // multimedia

    if (fileType === "mp4" || fileType === "mpeg") {
      return {
        "Content-Type": `video/${fileType};`,
        "Content-Disposition": "attachment",
        "type": "video"
      }
    }

    if (fileType === "pdf") {
      return {
        "Content-Type": `application/${fileType};`,
        "Content-Disposition": "attachment",
        "type": "pdf"
      }
    }

    content = JSON.parse(content);
    return {
      "Content-Type": "application/json; charset=UTF-8",
      "Content-Disposition": "inline",
      "type": "json"
    }
  } catch (err) {
    return {
      "Content-Type": "text/plain; charset=UTF-8",
      "Content-Disposition": "inline",
      "type": "text"
    }
  }
}