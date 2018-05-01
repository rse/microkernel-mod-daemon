/*
**  Microkernel -- Microkernel for Server Applications
**  Copyright (c) 2016-2018 Ralf S. Engelschall <rse@engelschall.com>
**
**  Permission is hereby granted, free of charge, to any person obtaining
**  a copy of this software and associated documentation files (the
**  "Software"), to deal in the Software without restriction, including
**  without limitation the rights to use, copy, modify, merge, publish,
**  distribute, sublicense, and/or sell copies of the Software, and to
**  permit persons to whom the Software is furnished to do so, subject to
**  the following conditions:
**
**  The above copyright notice and this permission notice shall be included
**  in all copies or substantial portions of the Software.
**
**  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
**  EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
**  MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
**  IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
**  CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
**  TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
**  SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

/*  external requirements  */
const path      = require("path")
const sprintf   = require("sprintfjs")
const daemonize = require("daemonize.redux")

/*  the Microkernel module  */
/* eslint no-console: 0 */
class Module {
    get module () {
        /*  publish module information  */
        return {
            name:  "microkernel-mod-daemon",
            tag:   "DAEMON",
            group: "BOOT",
            after: [ "CTX", "OPTIONS" ]
        }
    }
    latch (kernel) {
        /*  provide command-line options  */
        let pidfile = path.join(kernel.rs("ctx:basedir"), kernel.rs("ctx:program") + ".pid")
        kernel.latch("options:options", (options) => {
            options.push(
                { names: [ "daemon" ], type: "bool", "default": false,
                    help: "Run as a daemon (detached from terminal)" })
            options.push(
                { names: [ "daemon-kill" ], type: "bool", "default": false,
                    help: "Kill daemon process" })
            options.push(
                { names: [ "daemon-pidfile" ], type: "string", "default": pidfile,
                    help: "Path to PID file for daemon operation", helpArg: "PATH" })
        })
    }
    start (kernel) {
        /*  act only on our functionality  */
        if (!(kernel.rs("options:options").daemon || kernel.rs("options:options").daemon_kill))
            return

        /*  determine absolute path to ourself  */
        let script = path.resolve(process.argv[1])

        /*  provide arguments without the --daemon option
            (to prevent a recursive behaviour)  */
        let argv = process.argv
            .filter((arg /*, idx, arr */) => (arg !== "--daemon"))
            .slice(2)

        /*  setup the daemonization  */
        let daemon = daemonize.setup({
            args:        [],
            main:        script,
            name:        script,
            argv:        argv,
            pidfile:     path.resolve(kernel.rs("options:options").daemon_pidfile),
            silent:      true,
            stopTimeout: 2,
            stdin:       "ignore",
            stdout:      "ignore",
            stderr:      "ignore"
        })

        /*  determine daemon status  */
        let pid = daemon.status()

        /*  start or stop daemon  */
        if (kernel.rs("options:options").daemon) {
            /*  ensure daemon is still not running  */
            if (pid !== 0) {
                console.log(sprintf("%s: ERROR: already running as daemon under PID %d",
                    kernel.rs("ctx:program"), pid))
                process.exit(1)
            }

            /*  switch to daemon mode
                (in a never resolved or rejected promise to block the execution
                of the whole application until we terminate it ourself here)  */
            return new Promise((/* resolve, reject */) => {
                daemon.on("error", (err) => {
                    console.log(sprintf("%s: ERROR: error during daemonizing: %s",
                        kernel.rs("ctx:program"), err))
                    process.exit(1)
                })
                daemon.on("started", (pid2) => {
                    console.log(sprintf("%s: OK: daemonized (PID: %d)",
                        kernel.rs("ctx:program"), pid2))
                    process.exit(0)
                })
                daemon.start()
            })
        }
        else if (kernel.rs("options:options").daemon_kill) {
            /*  ensure daemon is already running  */
            if (pid === 0) {
                console.log(sprintf("%s: ERROR: daemon not running", kernel.rs("ctx:program")))
                process.exit(1)
            }

            /*  stop daemon
                (in a never resolved or rejected promise to block the execution
                of the whole application until we terminate it ourself here)  */
            return new Promise((/* resolve, reject */) => {
                daemon.on("error", (err) => {
                    console.log(sprintf("%s: ERROR: error during daemon killing: %s",
                        kernel.rs("ctx:program"), err))
                    process.exit(1)
                })
                daemon.on("stopped", (pid2) => {
                    console.log(sprintf("%s: OK: daemon killed (PID: %d)",
                        kernel.rs("ctx:program"), pid2))
                    process.exit(0)
                })
                daemon.kill()
            })
        }
    }
}

/*  export the Microkernel module  */
module.exports = Module

