'use strict';

const fs = require('fs');
const path = require('path');
const url = require('url');
const cp = require("child_process");

/*
 * Process {% Download src=/python/file/path %}{% endDownload %}
 *
 */
 
function processDownloadBlock( block ){
    const src = block.kwargs.src;
    const ctxFilePath = this.ctx.ctx.file.path || null;
    const relativeSrcPath = url.resolve(ctxFilePath, src);
    const link = `<a href="/${relativeSrcPath}" target="_blank">Download example</a>`;
    return link;
}

/*
 *  Parse markdown page and process !PYTHON instruction  
 *  The !PYTHON include should have the following form 
 *  !PYTHON src=path/to/python/file exec=true|false 
 *  The src tag is the python file path to include in the gitbook  
 *  The exec tag specify if the python script should be executed 
 *  and its outputs displayed in the gitbook 
 *
 */ 
function processPythonInclude( page ){

    const dirPath = path.dirname(page.rawPath);
    var lines = page.content.split("\n");
    // !PYTHON src="" exec=true link=true
    const token = "!PYTHON"
    var pageContent = "";
    var outputContent = "";
    for (let i = 0; i < lines.length; i++) {
        if( lines[i].includes(token) ){
            var line = lines[i];
            var tokens = line.replace(token, "").trim().split(" ");
            var args = {}
            for( let j=0; j<tokens.length; j++){
                var the_arg= tokens[j].split("=");
                args[the_arg[0]] = the_arg[1]; 
            }

            var pyContent;
            if( "src" in args ){
                var relPath = args["src"];
                var py_path = path.join(dirPath, relPath);
                pyContent = fs.readFileSync(py_path, "utf8");
                
                if( "exec" in args && args.exec == "true"){
                    // Exec python script and catch stdout
                    const wdir = path.dirname(py_path);
                    const pyfile = path.basename(py_path);
                    const cmd = this.config.get("pluginsConfig.python.executable", "python"); 
                    const cmd_arg = pyfile;
                    const timeout = 1000.*this.config.get("pluginsConfig.python.timeout", 60.);
                    var child = cp.spawnSync(cmd,[cmd_arg, ],  {cwd:wdir, 
                                                timeout:timeout});
                    
                    if( child.status != 0 ){
                        outputContent = "Execution Error "
                        this.log.warn(pyfile + " Python execution failed");
                        this.log.debug('error ', child.error);
                        this.log.debug('stdout ', child.stdout.toString());
                        this.log.debug('stderr ', child.stderr.toString());
                    }
                    else{
                        this.log.info(pyfile + " succeed")
                        outputContent = child.stdout.toString();
                    }
                }
            }
            else{
                this.log.warn("!PYTHON tag found but no source file specified");
                continue; 
            }

            pageContent += "```python\n"
            pageContent += pyContent + "\n";
            pageContent += "```\n";
            pageContent += "{\% Download src=\"" + args.src + "\" \%} {\% endDownload \%}\n";
            if( outputContent != ""){
                pageContent += "```\n" + outputContent + "\n```\n";
            }

        }
        else{
            pageContent += lines[i] + "\n";
        }

    }
    //console.log(this);
    page.content = pageContent;
    return page;
}

module.exports = {
    blocks: {
        Download: {
            process: processDownloadBlock,
        }
    },
    hooks: {
        "page:before": processPythonInclude,
    }
}