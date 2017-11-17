import * as ast from './parsers/python/python_parser';



export class Block {
    constructor(
        public id: number,
        private hint: string,
        public statements: ast.ISyntaxNode[]) {
    }

    public toString(): string {
        return 'BLOCK ' + this.id + ' (' + this.hint + ')\n' +
            this.statements.map(s => '    ' + JSON.stringify(s)).join('\n');
    }
}


class Context {
    constructor(
        public loopHead: Block,
        public loopExit: Block,
        public exceptionBlock: Block) {
    }
    public forLoop(loopHead: Block, loopExit: Block): Context {
        return new Context(loopHead, loopExit, this.exceptionBlock);
    }
    public forExcepts(exceptionBlock: Block): Context {
        return new Context(this.loopHead, this.loopExit, exceptionBlock);
    }
}


export class ControlFlowGraph {
    private _blocks: Block[] = [];
    private globalId = 0;
    private entry: Block;
    private exit: Block;
    private successors = new Set<[Block, Block]>();

    constructor(module: ast.IModule) {
        [this.entry, this.exit] = this.makeCFG(
            'entry', module.code, new Context(null, null, this.makeBlock('exceptional exit')));
    }

    private makeBlock(hint: string, statements: ast.ISyntaxNode[] = []) {
        const b = new Block(this.globalId++, hint, statements);
        this._blocks.push(b);
        return b;
    }

    public get blocks(): Block[] {
        const result: Block[] = [];
        const visited = new Set<Block>();
        const toVisit = new Set<Block>([this.entry]);
        while (toVisit.size) {
            const block = toVisit.values().next().value;
            toVisit.delete(block);
            visited.add(block);
            result.push(block);
            for (let [pred, succ] of this.successors.values()) {
                if (pred === block && !visited.has(succ)) {
                    toVisit.add(succ);
                }
            }
        }
        return result;
    }

    public getSuccessors(block: Block): Block[] {
        return [...this.successors.values()]
            .filter(([p, _]) => p == block)
            .map(([_, s]) => s);
    }

    public getPredecessors(block: Block): Block[] {
        return [...this.successors.values()]
            .filter(([_, s]) => s == block)
            .map(([p, _]) => p);
    }

    public print() {
        console.log('CFG', 'ENTRY:', this.entry.id, 'EXIT:', this.exit.id);
        this.blocks.forEach(block => {
            console.log(block.toString());
            if (block === this.exit) {
                console.log('    EXIT');
            } else {
                console.log('    SUCC',
                    this.getSuccessors(block).map(b => b.id.toString()).join(','));
            }
        });
    }

    private link(...blocks: Block[]): void {
        for (let i = 1; i < blocks.length; i++)
            this.successors.add([blocks[i - 1], blocks[i]]);
    }

    private handleIf(statement: ast.IIf, last: Block, context: Context): Block {
        const ifCondBlock = this.makeBlock('if cond', [statement.cond]);
        const [bodyEntry, bodyExit] = this.makeCFG('if body', statement.code, context);
        this.link(last, ifCondBlock, bodyEntry);
        const joinBlock = this.makeBlock('conditional join');
        this.link(bodyExit, joinBlock);
        let lastCondBlock: Block = ifCondBlock;
        if (statement.elif) {
            for (let elif of statement.elif) {
                const elifCondBlock = this.makeBlock('elif cond', [elif.cond]);
                this.link(lastCondBlock, elifCondBlock);
                const [elifEntry, elifExit] = this.makeCFG('elif body', elif.code, context);
                this.link(elifCondBlock, elifEntry);
                this.link(elifExit, joinBlock);
                lastCondBlock = elifCondBlock;
            }
        }
        if (statement.else && statement.else.length) {
            const [elseEntry, elseExit] = this.makeCFG('else body', statement.else, context);
            this.link(lastCondBlock, elseEntry);
            this.link(elseExit, joinBlock);
        } else {
            this.link(lastCondBlock, joinBlock);
        }
        return joinBlock;
    }

    private handleWhile(statement: ast.IWhile, last: Block, context: Context): Block {
        const loopHeadBlock = this.makeBlock('while loop head', [statement.cond]);
        this.link(last, loopHeadBlock);
        const afterLoop = this.makeBlock('while loop join');
        const [bodyEntry, bodyExit] = this.makeCFG('while body', statement.code, context.forLoop(loopHeadBlock, afterLoop));
        this.link(loopHeadBlock, bodyEntry);
        this.link(bodyExit, loopHeadBlock); // back edge
        this.link(loopHeadBlock, afterLoop);
        return afterLoop;
    }

    private handleFor(statement: ast.IFor, last: Block, context: Context): Block {
        const loopHeadBlock = this.makeBlock('for loop head',
            // synthesize a statement to simulate using the iterator
            [{ type: ast.ASSIGN, sources: [statement.iter], targets: [statement.target] }]);
        this.link(last, loopHeadBlock);
        const afterLoop = this.makeBlock('for loop join');
        const [bodyEntry, bodyExit] = this.makeCFG('while body', statement.code, context.forLoop(loopHeadBlock, afterLoop));
        this.link(loopHeadBlock, bodyEntry);
        this.link(bodyExit, loopHeadBlock); // back edge
        this.link(loopHeadBlock, afterLoop);
        return afterLoop;
    }

    private handleWith(statement: ast.IWith, last: Block, context: Context): Block {
        const assignments = statement.items.map(
            ({ with: w, as: a }) => (<ast.IAssignment>{ type: ast.ASSIGN, targets: [a], sources: [w] }))
        const resourceBlock = this.makeBlock('with', assignments);
        this.link(last, resourceBlock);
        const [bodyEntry, bodyExit] = this.makeCFG('with body', statement.code, context);
        this.link(resourceBlock, bodyEntry);
        return bodyExit;
    }

    private handleTry(statement: ast.ITry, last: Block, context: Context): Block {
        const afterTry = this.makeBlock('try join');
        let exnContext = context;
        let handlerExits: Block[] = [];
        if (statement.excepts) {
            const handlerHead = this.makeBlock('handlers');
            const handlerCfgs = statement.excepts.map(
                handler => this.makeCFG('handler body', handler.code, context));
            handlerCfgs.forEach(([exceptEntry, _]) => this.link(handlerHead, exceptEntry));
            exnContext = context.forExcepts(handlerHead);
            handlerExits = handlerCfgs.map(([_, exceptExit]) => exceptExit);
        }
        const [bodyEntry, bodyExit] = this.makeCFG('try body', statement.code, exnContext);
        this.link(last, bodyEntry);
        if (statement.finally) {
            const [finallyEntry, finallyExit] = this.makeCFG('finally body', statement.finally, context);
            this.link(bodyExit, finallyEntry);
            this.link(finallyExit, afterTry);
            handlerExits.forEach(handlerExit => this.link(handlerExit, finallyEntry));
        } else {
            handlerExits.forEach(handlerExit => this.link(handlerExit, afterTry));
            this.link(bodyExit, afterTry);
        }
        return afterTry;
    }

    private makeCFG(hint: string, statements: ast.ISyntaxNode[], context: Context): [Block, Block] {
        const entry = this.makeBlock(hint);
        let last = entry;
        loop: for (let statement of statements) {
            switch (statement.type) {
                case ast.DEF:
                    break;
                case ast.IF:
                    last = this.handleIf(statement, last, context);
                    break;
                case ast.WHILE:
                    last = this.handleWhile(statement, last, context);
                    break;
                case ast.FOR:
                    last = this.handleFor(statement, last, context);
                    break;
                case ast.WITH:
                    last = this.handleWith(statement, last, context);
                    break;
                case ast.TRY:
                    last = this.handleTry(statement, last, context);
                    break;
                case ast.RAISE:
                    this.link(last, context.exceptionBlock);
                    break loop;
                case ast.BREAK:
                    this.link(last, context.loopExit);
                    break loop;
                case ast.CONTINUE:
                    this.link(last, context.loopHead);
                    break loop;
                default:
                    last.statements.push(statement);
                    break;
            }
        }
        return [entry, last];
    }
}
