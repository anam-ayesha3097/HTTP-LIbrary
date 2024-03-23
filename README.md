# Requirements

1. You need install node 4.2.1 or later
2. Run `npm install` to install dependencies

# Run http file server

node httpserver.js 
    Default port: 8007 
OR
node httpserver.js [--port portNo] 


# Help

node httpfs help

node httpfs help GET

node httpfs help POST

# Test Cases

node httpfs GET

node httpfs GET /

node httpfs POST -f hello.txt -d "Hello Javascript is Fun!"

# Overwrite:

node httpfs POST -f hello.txt -d "Hello" -o 

# Verbose: 

node httpfs GET -v

# Additional Test Cases
node .\httpfs.js GET /inner/test.txt
node httpfs POST /inner/test.txt -d "Hello Javascript is Fun!" -o
node .\httpfs.js GET /inner/test.txt

# Insufficient access

node httpfs POST /G:/hello10.txt -d "Hello Javascriptttt is Fun!" -o

node .\httpfs.js GET "G:\Games\hey.txt"


# Concurrently Writing to the same file test.txt
1.  node .\multiuser.js "POST /inner/test.txt -d Hey821 -o" "POST /inner/test.txt -d Hey9234 -o"  

# Concurrent Write and Read the same file test.txt
2.  node .\multiuser.js "POST /inner/test.txt -d Hey821 -o" "GET /inner/test.txt"  

# Concurrent Read the same file test.txt
3.  node .\multiuser.js "GET /inner/test.txt" "GET /inner/test.txt" 

# Test Content-Type and Content-Disposition
1. text file - node .\httpfs.js GET /inner/test.txt
2. video file - node .\httpfs.js GET /inner/test.mp4
3. image file - node .\httpfs.js GET /inner/test.png
4. pdf file - node .\httpfs.js GET /inner/test.pdf


# if you specified a different port number then add --port flag for each of the client request made! 
