# Package
version       = "0.3.0"
author        = "Ray Perry"
description   = "The Kintsugi Programming Language"
license       = "MIT"
srcDir        = "src"
bin           = @["kintsugi"]
binDir        = "bin"

# Dependencies
requires "nim >= 2.0.0"

task build, "Build the interpreter":
  exec "nim c -d:release --outdir:bin src/kintsugi.nim"

task test, "Run all tests":
  for f in listFiles("tests"):
    if f.endsWith(".nim") and f.startsWith("tests/test_") and f != "tests/debug.nim":
      exec "nim c -r --outdir:bin/tests " & f
