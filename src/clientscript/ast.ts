import { clientscript } from "../../generated/clientscript";
import { clientscriptdata } from "../../generated/clientscriptdata";
import { CacheFileSource } from "../cache";
import { parse } from "../opdecoder";
import { ClientScriptOp, ClientscriptObfuscation, OpcodeInfo, ScriptCandidate, StackDiff, StackInOut, StackType, StackList, getArgType, getReturnType, knownClientScriptOpNames, namedClientScriptOps, StackConstants, branchInstructions, StackConst, prepareClientScript, typeToPrimitive, dynamicOps } from "./callibrator";

/**
 * known issues
 * - If all branches (and default) of a switch statement return, then the last branch is emptied and its contents are placed after the end of the block (technically still correct)
 *   - has to do with the way the branching detection works (AstNode.findNext)
 * - some op arguments still not figured out
 * - none of this is tested for older builds
 *   - probably breaks at the build where pushconst ops were merged (~700?)
 */
//get script names from https://api.runewiki.org/hashes?rev=930



function codeIndent(amount: number, linenr = -1, hasquestionmark = false) {
    return (linenr == -1 ? "" : linenr + ":").padEnd(5 + amount * 4, " ") + (hasquestionmark ? "?? " : "   ");
}

export abstract class AstNode {
    parent: AstNode | null = null;
    knownStackDiff: StackInOut | null = null;
    children: AstNode[] = [];
    originalindex: number;
    constructor(originalindex: number) {
        this.originalindex = originalindex;
    }
    getName(calli: ClientscriptObfuscation): { name: string, extra: string } {
        return { name: "unk", extra: "" };
    }
    getCode(calli: ClientscriptObfuscation, indent: number): string {
        return `unk(${this.children.map(q => q.getCode(calli, indent)).join(",")})`
    }
    pushList(nodes: AstNode[]) {
        for (let node of nodes) {
            node.parent = null;//prevents parent array shuffle
            this.push(node);
        }
    }
    push(node: AstNode) {
        if (node == this) { throw new Error("tried to add self to ast children"); }
        node.parent?.remove(node);
        this.children.push(node);
        node.parent = this;
    }
    clear() {
        this.children.forEach(q => q.parent = null);
        this.children.length = 0;
    }
    unshift(node: AstNode) {
        node.parent?.remove(node);
        this.children.unshift(node);
        node.parent = this;
    }
    replaceChild(oldnode: AstNode, newnode: AstNode) {
        if (newnode == this) { throw new Error("tried to add self to ast children"); }
        newnode.parent?.remove(newnode);
        let index = this.children.indexOf(oldnode);
        if (index == -1) { throw new Error("tried to replace node that isn't a child"); }
        newnode.parent = this;
        oldnode.parent = null;
        this.children[index] = newnode;
    }
    remove(node: AstNode) {
        let index = this.children.indexOf(node);
        if (index == -1) { throw new Error("tried to remove node that isn't a child"); }
        this.children.splice(index, 1);
        node.parent = null;
    }
}

class VarAssignNode extends AstNode {
    varops: AstNode[] = [];
    knownStackDiff = new StackInOut(new StackList(), new StackList());
    getName(calli: ClientscriptObfuscation) {
        let name = `${this.varops.map(q => q instanceof RawOpcodeNode ? q.getName(calli).name : "??")}`;
        return { name: name, extra: "" };
    }
    getCode(calli: ClientscriptObfuscation, indent: number) {
        let name = this.getName(calli);
        return `${name.name} = ${this.children.map(q => q.getCode(calli, indent)).join(",")}`
    }
    addVar(node: AstNode) {
        this.varops.unshift(node);
        this.knownStackDiff.in.push(getNodeStackIn(node));
    }
}

export class CodeBlockNode extends AstNode {
    scriptid: number;
    possibleSuccessors: CodeBlockNode[] = [];
    firstPointer: CodeBlockNode | null = null;
    lastPointer: CodeBlockNode | null = null;
    branchEndNode: CodeBlockNode | null = null;
    maxEndIndex = -1;

    knownStackDiff = new StackInOut(new StackList(), new StackList());
    constructor(scriptid: number, startindex: number, children?: AstNode[]) {
        super(startindex);
        this.scriptid = scriptid;
        if (children) {
            this.pushList(children);
        }
    }
    addSuccessor(block: CodeBlockNode) {
        if (this.originalindex < block.originalindex && (!block.firstPointer || this.originalindex < block.firstPointer.originalindex)) {
            block.firstPointer = this;
        }
        if (this.originalindex > block.originalindex && (!block.lastPointer || this.originalindex > block.lastPointer.originalindex)) {
            block.lastPointer = this;
            block.maxEndIndex = this.originalindex;
        }
        //successors are required to be duplicate when there is a 0 jump branch
        // if (this.possibleSuccessors.includes(block)) { throw new Error("added same successor twice"); }
        if (!block) { throw new Error("added null successor"); }
        this.possibleSuccessors.push(block);
    }
    mergeBlock(block: CodeBlockNode, flatten: boolean) {
        if (flatten) {
            this.pushList(block.children);
            block.children.length = 0;
        } else {
            this.push(block);
        }
        this.possibleSuccessors = block.possibleSuccessors;
        this.branchEndNode = block.branchEndNode;
    }
    findNext() {
        if (!this.branchEndNode) {
            if (this.possibleSuccessors.length == 0) {
                this.branchEndNode = null;
            } else if (this.possibleSuccessors.length == 1) {
                if (this.possibleSuccessors[0].originalindex < this.originalindex) {
                    this.branchEndNode = null;//looping jump
                } else {
                    this.branchEndNode = this.possibleSuccessors[0];
                }
            } else {
                let optionstates = this.possibleSuccessors.slice() as (CodeBlockNode | null)[];
                while (true) {
                    let first: CodeBlockNode | null = null;
                    for (let op of optionstates) {
                        if (op && (first == null || op.originalindex < first.originalindex)) {
                            first = op;
                        }
                    }
                    if (!first) {
                        this.branchEndNode = null;
                        break;
                    }
                    if (optionstates.every(q => !q || q == first)) {
                        this.branchEndNode = first;
                        break;
                    }
                    optionstates[optionstates.indexOf(first)] = first.findNext();
                }
            }
        }
        return this.branchEndNode;
    }
    getName(calli: ClientscriptObfuscation) {
        return { name: `code block`, extra: "" };
    }
    getCode(calli: ClientscriptObfuscation, indent: number) {
        let code = "";
        // code += `============ section ${this.originalindex} ${this.branchEndNode?.originalindex ?? "nope"} ============\n`;
        // code += `${node.originalindex.toString().padStart(4, " ")}: ${(indent + optext.name).slice(0, 20).padEnd(20, " ")}`;
        // code += optext.extra;
        // code += "\n";
        if (this.parent) { code += `{\n`; indent++; }
        for (let child of this.children) {
            code += `${codeIndent(indent, child.originalindex)}${child.getCode(calli, indent)}\n`;
        }
        if (this.parent) { code += `${codeIndent(indent - 1)}}`; }
        return code;
    }
    dump() {
        console.log(`[${this.scriptid},${this.originalindex}]\n` + this.getCode(globalThis.deob, 0));//TODO remove
    }
}

type BinaryOpType = "||" | "&&" | ">" | ">=" | "<" | "<=" | "==" | "!=" | "(unk)";
class BinaryOpStatement extends AstNode {
    type: BinaryOpType;
    knownStackDiff = new StackInOut(new StackList(["int", "int"]), new StackList(["int"]));//TODO not correct, we also use this for longs
    constructor(type: BinaryOpType, originalindex: number) {
        super(originalindex);
        this.type = type;
    }

    getCode(calli: ClientscriptObfuscation, indent: number) {
        if (this.children.length == 2) {
            return `(${this.children[0].getCode(calli, indent)} ${this.type} ${this.children[1].getCode(calli, indent)})`;
        } else {
            return `(${this.type} ${this.children.map(q => q.getCode(calli, indent)).join(" ")})`;
        }
    }
}

class WhileLoopStatementNode extends AstNode {
    statement: AstNode;
    body: CodeBlockNode;
    knownStackDiff = new StackInOut(new StackList(), new StackList());
    constructor(parentblock: CodeBlockNode, originnode: IfStatementNode) {
        super(parentblock.originalindex);
        if (originnode.falsebranch) { throw new Error("cannot have else branch in loop"); }
        if (!originnode.parent) { throw new Error("unexpected"); }
        this.statement = originnode.statement;
        this.body = originnode.truebranch;
    }
    getCode(calli: ClientscriptObfuscation, indent: number) {
        let res = `while(${this.statement.getCode(calli, indent)})`;
        res += this.body.getCode(calli, indent);
        return res;
    }
}

class SwitchStatementNode extends AstNode {
    branches: { value: number, block: CodeBlockNode }[] = [];
    valueop: AstNode | null;
    defaultbranch: CodeBlockNode | null = null;
    knownStackDiff = new StackInOut(new StackList(["int"]), new StackList());
    constructor(switchop: RawOpcodeNode, scriptjson: clientscript, nodes: CodeBlockNode[], endindex: number) {
        super(switchop.originalindex);
        this.valueop = switchop.children[0] ?? null;
        this.pushList(switchop.children);

        let cases = scriptjson.switches[switchop.op.imm];
        if (!cases) { throw new Error("no matching cases in script"); }
        for (let casev of cases) {
            //TODO multiple values can point to the same case
            let node = nodes.find(q => q.originalindex == switchop.originalindex + 1 + casev.label);
            if (!node) { throw new Error("switch case branch not found"); }
            this.branches.push({ value: casev.value, block: node });
            this.push(node);
            node.maxEndIndex = endindex;
            if (node.originalindex != switchop.originalindex + 1 + casev.label) {
                throw new Error("switch branches don't match");
            }
        }


        let defaultblock: CodeBlockNode | null = nodes.find(q => q.originalindex == switchop.originalindex + 1) ?? null;
        if (defaultblock && defaultblock.children.length == 1 && defaultblock.children[0] instanceof RawOpcodeNode && defaultblock.children[0].opinfo.id == namedClientScriptOps.jump) {
            if (defaultblock.possibleSuccessors.length != 1) { throw new Error("jump successor branch expected"); }
            defaultblock = defaultblock.possibleSuccessors[0];
            if (defaultblock.originalindex == endindex) {
                defaultblock = null;
            }
        }

        if (defaultblock) {
            this.push(defaultblock);
            defaultblock.maxEndIndex = endindex;
            this.defaultbranch = defaultblock;
        }
    }
    getCode(calli: ClientscriptObfuscation, indent: number) {
        let res = "";
        res += `switch(${this.valueop?.getCode(calli, indent) ?? ""}){\n`;
        for (let [i, branch] of this.branches.entries()) {
            res += `${codeIndent(indent + 1, branch.block.originalindex)}case ${branch.value}:`;
            if (i + 1 < this.branches.length && this.branches[i + 1].block == branch.block) {
                res += `\n`;
            } else {
                res += branch.block.getCode(calli, indent + 1);
                res += `\n`;
            }
        }
        if (this.defaultbranch) {
            res += `${codeIndent(indent + 1)}default:`;
            res += this.defaultbranch.getCode(calli, indent + 1);
        }
        res += `\n`;
        res += `${codeIndent(indent)}}`;
        return res;
    }
}

class IfStatementNode extends AstNode {
    truebranch!: CodeBlockNode;
    falsebranch!: CodeBlockNode | null;
    statement!: AstNode;
    endblock: CodeBlockNode;
    knownStackDiff = new StackInOut(new StackList(["int"]), new StackList());
    ifEndIndex!: number;
    constructor(statement: AstNode, endblock: CodeBlockNode, truebranch: CodeBlockNode, falsebranch: CodeBlockNode | null, endindex: number) {
        if (truebranch == falsebranch) { throw new Error("unexpected"); }
        super(statement.originalindex);
        this.endblock = endblock;
        this.setBranches(statement, truebranch, falsebranch, endindex);
    }
    setBranches(statement: AstNode, truebranch: CodeBlockNode, falsebranch: CodeBlockNode | null, endindex: number) {
        this.ifEndIndex = endindex;
        //statement
        this.statement = statement;
        this.push(statement);

        //true
        this.truebranch = truebranch;
        truebranch.maxEndIndex = this.ifEndIndex;

        //false
        this.falsebranch = falsebranch;
        if (falsebranch) {
            falsebranch.maxEndIndex = this.ifEndIndex;
        }

        //need the children in the original order to make sure && and || merges correctly
        if (falsebranch && falsebranch.originalindex < truebranch.originalindex) {
            this.push(falsebranch);
        }
        this.push(truebranch);
        if (falsebranch && falsebranch.originalindex > truebranch.originalindex) {
            this.push(falsebranch);
        }
    }
    getCode(calli: ClientscriptObfuscation, indent: number) {
        let res = `if(${this.statement.getCode(calli, indent)})`;
        res += this.truebranch?.getCode(calli, indent);
        if (this.falsebranch) {
            res += `else`;
            //skip brackets for else if construct
            if (this.falsebranch instanceof CodeBlockNode && this.falsebranch.children.length == 1 && this.falsebranch.children[0] instanceof IfStatementNode) {
                res += " " + this.falsebranch.children[0].getCode(calli, indent);
            } else {
                res += this.falsebranch.getCode(calli, indent);
            }
        }
        return res;
    }
}

export class FunctionBindNode extends AstNode {
    constructor(originalindex: number, types: StackList) {
        super(originalindex);
        let intype = types.clone();
        intype.values.unshift("int");//function id
        this.knownStackDiff = new StackInOut(intype, new StackList(["int", "vararg"]));
    }

    getCode(calli: ClientscriptObfuscation, indent: number) {
        let scriptid = this.children[0]?.knownStackDiff?.constout ?? -1;
        return `bind[${scriptid}](${this.children.slice(1).map(q => q.getCode(calli, indent))})`;
    }
}

export class RawOpcodeNode extends AstNode {
    op: ClientScriptOp;
    opinfo: OpcodeInfo;
    unknownstack = false;//multiple possible explanations for stack usage
    constructor(index: number, op: ClientScriptOp, opinfo: OpcodeInfo) {
        super(index);
        this.op = op;
        this.opinfo = opinfo;
    }
    getName(calli: ClientscriptObfuscation) {
        let opinfo = calli.decodedMappings.get(this.op.opcode);
        if (!opinfo) { throw new Error("unknown op"); }
        let name = knownClientScriptOpNames[this.op.opcode] ?? `unk${this.op.opcode}`;
        if (opinfo.id == namedClientScriptOps.poplocalint || opinfo.id == namedClientScriptOps.pushlocalint) {
            name = `int${this.op.imm}`;
        } else if (opinfo.id == namedClientScriptOps.poplocalstring || opinfo.id == namedClientScriptOps.pushlocalstring) {
            name = `string${this.op.imm}`;
        } else if (opinfo.id == namedClientScriptOps.popvar || opinfo.id == namedClientScriptOps.pushvar) {
            let varmeta = calli.getClientVarMeta(this.op.imm);
            if (varmeta) {
                name = `var${varmeta.name}_${varmeta.varid}`;
            } else {
                name = `varunk_${this.op.imm}`;
            }
        }
        let res = "";
        res += (typeof this.op.imm_obj == "string" ? `"${this.op.imm_obj}"` : (this.op.imm_obj ?? "").toString());
        res += ` ${(this.knownStackDiff ?? this.opinfo.stackinfo).getCode() ?? "unkstack"}`;
        return { name: name, extra: res };
    }
    getCode(calli: ClientscriptObfuscation, indent: number) {
        let opinfo = calli.decodedMappings.get(this.op.opcode);
        if (!opinfo) { throw new Error("unknown op"); }
        let { name, extra } = this.getName(calli);
        if (this.op.opcode == namedClientScriptOps.pushconst) {
            return typeof this.op.imm_obj == "string" ? `"${this.op.imm_obj.replace(/(["\\])/g, "\\$1")}"` : "" + this.op.imm_obj;
        }
        if (this.op.opcode == namedClientScriptOps.pushlocalint || this.op.opcode == namedClientScriptOps.pushlocalstring || this.op.opcode == namedClientScriptOps.pushvar) {
            return name;
        }
        if (this.children.length == 2) {
            if (this.op.opcode == namedClientScriptOps.plus) {
                return `(${this.children[0].getCode(calli, indent)} + ${this.children[1].getCode(calli, indent)})`;
            }
            if (this.op.opcode == namedClientScriptOps.minus) {
                return `(${this.children[0].getCode(calli, indent)} - ${this.children[1].getCode(calli, indent)})`;
            }
            if (this.op.opcode == namedClientScriptOps.intdiv) {
                return `(${this.children[0].getCode(calli, indent)} / ${this.children[1].getCode(calli, indent)})`;
            }
            if (this.op.opcode == namedClientScriptOps.intmod) {
                return `(${this.children[0].getCode(calli, indent)} % ${this.children[1].getCode(calli, indent)})`;
            }
            if (this.op.opcode == namedClientScriptOps.strconcat) {
                return `(${this.children[0].getCode(calli, indent)} strcat ${this.children[1].getCode(calli, indent)})`;
            }
        }
        if (this.op.opcode == namedClientScriptOps.joinstring) {
            let res = "`";
            for (let child of this.children) {
                if (child instanceof RawOpcodeNode && child.opinfo.id == namedClientScriptOps.pushconst && typeof child.op.imm_obj == "string") {
                    res += child.op.imm_obj;
                } else {
                    res += `\${${child.getCode(calli, indent)}}`;
                }
            }
            res += "`";
            return res;
        }
        if (opinfo.id == namedClientScriptOps.jump || branchInstructions.includes(opinfo.id)) {
            name += `[${this.op.imm + this.originalindex + 1}]`;
        } else if (opinfo.id == namedClientScriptOps.gosub) {
            name += `[${this.op.imm}]`;
        } else if (this.op.imm != 0) {
            name += `[${this.op.imm}]`;
        }
        return `${name}(${this.children.map(q => q.getCode(calli, indent)).join(",")})`;
        // let diff = this.knownStackDiff ?? this.opinfo.stackinfo;
        // return `${name}<${diff.out.values.join(",")}>${diff.initializedthrough ? "" : "??"}(${diff.in.values.join(",")})`;
    }
}

class RewriteCursor {
    rootnode: AstNode;
    cursorStack: AstNode[] = [];
    stalled = true;
    constructor(node: AstNode) {
        this.rootnode = node;
    }
    current() {
        return this.cursorStack.at(-1) ?? null;
    }
    setFirstChild(target: AstNode, stall = false) {
        this.stalled = stall;
        if (target != this.cursorStack.at(-1)) {
            this.cursorStack.push(target);
        }
        while (target.children.length != 0) {
            target = target.children[0];
            this.cursorStack.push(target);
        }
        return this.cursorStack.at(-1) ?? null;
    }
    remove() {
        let node = this.current();
        let newcurrent = this.prev();
        if (!node) { throw new Error("no node selected"); }
        if (!node.parent) { throw new Error("cannot remove root node"); }
        node.parent.remove(node);
        return newcurrent;
    }
    rebuildStack() {
        let current = this.current();
        this.cursorStack.length = 0;
        for (let node = current; node; node = node.parent) {
            this.cursorStack.unshift(node);
        }
    }
    replaceNode(newnode: AstNode) {
        let node = this.current();
        if (!node) { throw new Error("no node selected"); }
        if (!node.parent) { throw new Error("cannot replace root node"); }
        node.parent.replaceChild(node, newnode);
        this.cursorStack[this.cursorStack.length - 1] = newnode;
        return newnode;
    }
    next() {
        if (this.stalled) {
            this.stalled = false;
            //stalled at null==space before start
            if (this.cursorStack.length == 0) {
                this.goToStart();
            }
            return this.current();
        }
        let currentnode = this.cursorStack.at(-1);
        let parentnode = this.cursorStack.at(-2);
        if (!currentnode) { return null; }
        this.cursorStack.pop();
        if (!parentnode) { return null; }

        let index = parentnode.children.indexOf(currentnode);
        if (index == parentnode.children.length - 1) {
            return parentnode;
        }
        let newnode = parentnode.children[index + 1];
        return this.setFirstChild(newnode);
    }
    prev() {
        if (this.stalled) {
            this.stalled = false;
            return this.current();
        }
        let currentnode = this.cursorStack.at(-1);
        let parentnode = this.cursorStack.at(-2);
        if (!currentnode) { return null; }
        if (currentnode.children.length != 0) {
            let newnode = currentnode.children.at(-1)!;
            this.cursorStack.push(newnode);
            return newnode;
        }
        this.cursorStack.pop();
        if (!parentnode) {
            this.stalled = true;
            return null;
        }

        let index = parentnode.children.indexOf(currentnode);
        if (index == 0) {
            return this.prev();
        }
        let newnode = parentnode.children[index - 1];
        this.cursorStack.push(newnode);
        return newnode;
    }
    setNextNode(node: AstNode) {
        this.stalled = true;
        this.cursorStack.length = 0;
        for (let current: AstNode | null = node; current; current = current.parent) {
            this.cursorStack.unshift(current);
        }
    }
    goToStart() {
        this.stalled = false;
        this.cursorStack.length = 0;
        return this.setFirstChild(this.rootnode);
    }
    goToEnd() {
        this.stalled = false;
        this.cursorStack.length = 0;
        return null;
    }
}

function getNodeStackOut(node: AstNode) {
    if (node.knownStackDiff) {
        return node.knownStackDiff.out;
    }
    if (node instanceof RawOpcodeNode && node.opinfo.stackinfo) {
        return node.opinfo.stackinfo.out;
    }
    console.log("unknown stack out");
    return new StackList();
}

function getNodeStackIn(node: AstNode) {
    if (node.knownStackDiff) {
        return node.knownStackDiff.in;
    }
    if (node instanceof RawOpcodeNode && node.opinfo.stackinfo) {
        return node.opinfo.stackinfo.in;
    }
    console.log("unknown stack in");
    return new StackList();
}

export function translateAst(ast: CodeBlockNode) {
    let cursor = new RewriteCursor(ast);

    //merge variable assign nodes
    let currentassignnode: VarAssignNode | null = null;
    for (let node = cursor.goToStart(); node; node = cursor.next()) {
        let isassign = node instanceof RawOpcodeNode && (node.op.opcode == namedClientScriptOps.poplocalint || node.op.opcode == namedClientScriptOps.poplocalstring || node.op.opcode == namedClientScriptOps.popvar)
        if (isassign) {
            if (currentassignnode && currentassignnode.parent != node.parent) {
                throw new Error("ast is expected to be flat at this stage");
            }
            if (!currentassignnode) {
                currentassignnode = new VarAssignNode(node.originalindex);
                cursor.replaceNode(currentassignnode);
            } else {
                cursor.remove();
            }
            currentassignnode.addVar(node);
        } else {
            currentassignnode = null;
        }
    }

    let expandNode = (node: AstNode) => {
        if (node instanceof CodeBlockNode) { return; }
        let argtype = getNodeStackIn(node).clone();
        for (let i = node.children.length - 1; i >= 0; i--) {
            argtype.pop(getNodeStackOut(node.children[i]));
        }
        while (!argtype.isEmpty() && usablestackdata.length != 0) {
            let { stackel, stackconst } = usablestackdata.at(-1)!;
            let outtype = getNodeStackOut(stackel);
            if (argtype.hasSimple(bindargs)) {
                if (typeof stackconst != "string") { throw new Error("expected vararg string"); }
                usablestackdata.pop();
                let bindnode: FunctionBindNode;
                if (outtype.values.length == 1 && outtype.values[0] == "vararg") {
                    if (!stackel.knownStackDiff) { throw new Error("unexpected"); }
                    bindnode = new FunctionBindNode(stackel.originalindex, stackel.knownStackDiff.in);
                    bindnode.pushList(stackel.children);
                } else {
                    let maybearraylen = usablestackdata.at(-1)?.stackconst;
                    let args = varArgtype(stackconst, maybearraylen);
                    if (!args) { throw new Error("vararg const string expected"); }
                    bindnode = new FunctionBindNode(stackel.originalindex, args);
                }
                expandNode(bindnode);
                stackel.parent!.replaceChild(stackel, bindnode);

                outtype = getNodeStackOut(bindnode);
                stackel = bindnode;
            }
            if (outtype.isEmpty() || argtype.tryPop(outtype) != 0) { break; }
            node.unshift(stackel);
            usablestackdata.pop();
        }

        //update usable stack data
        let outtype = getNodeStackOut(node);
        if (outtype.isEmpty()) {
            usablestackdata.length = 0;
        } else {
            usablestackdata.push({ stackel: node, stackconst: node.knownStackDiff?.constout ?? null });
        }
    }

    //find call arguments
    let bindargs = new StackList(["int", "vararg"]);
    let usablestackdata: { stackel: AstNode, stackconst: StackConst }[] = [];
    for (let node = cursor.goToStart(); node; node = cursor.next()) {
        expandNode(node);
    }
    return ast;
}
function fixControlFlow(ast: AstNode, scriptjson: clientscript) {
    let cursor = new RewriteCursor(ast);
    //find if statements
    for (let node = cursor.goToStart(); node; node = cursor.next()) {
        if (node instanceof RawOpcodeNode && branchInstructions.includes(node.opinfo.id)) {
            let parent = node.parent;
            if (!(parent instanceof CodeBlockNode) || parent.possibleSuccessors.length != 2) { throw new Error("if op parent is not compatible"); }
            if (parent.children.at(-1) != node) { throw new Error("if op is not last op in codeblock"); }
            if (!parent.branchEndNode) { throw new Error("if statement parent end node expected"); }
            //TODO move this insto if class
            let optype: BinaryOpType;
            if (node.op.opcode == namedClientScriptOps.branch_eq) { optype = "=="; }
            else if (node.op.opcode == namedClientScriptOps.branch_gt) { optype = ">"; }
            else if (node.op.opcode == namedClientScriptOps.branch_gteq) { optype = ">="; }
            else if (node.op.opcode == namedClientScriptOps.branch_lt) { optype = "<"; }
            else if (node.op.opcode == namedClientScriptOps.branch_lteq) { optype = "<="; }
            else if (node.op.opcode == namedClientScriptOps.branch_not) { optype = "!="; }
            else { optype = "(unk)"; }

            let trueblock = parent.possibleSuccessors[1];
            let falseblock: CodeBlockNode | null = parent.possibleSuccessors[0];
            if (falseblock.children.length == 1 && falseblock.children[0] instanceof RawOpcodeNode && falseblock.children[0].opinfo.id == namedClientScriptOps.jump) {
                if (falseblock.possibleSuccessors.length != 1) { throw new Error("jump successor branch expected"); }
                falseblock = falseblock.possibleSuccessors[0];
                if (falseblock == parent.branchEndNode) {
                    falseblock = null;
                }
            }
            if (trueblock == parent.branchEndNode) {
                //empty true branch
                trueblock = new CodeBlockNode(trueblock.scriptid, trueblock.originalindex);
            }
            if (!(trueblock instanceof CodeBlockNode)) { throw new Error("true branch isn't a codeblock"); }
            if (falseblock && !(falseblock instanceof CodeBlockNode)) { throw new Error("false branch exists but is not a codeblock"); }

            //wrap loopable block with another codeblock
            if (trueblock.lastPointer) {
                let newblock = new CodeBlockNode(trueblock.scriptid, trueblock.originalindex);
                newblock.mergeBlock(trueblock, false);
                newblock.maxEndIndex = trueblock.maxEndIndex;
                trueblock = newblock;
            }
            if (falseblock && falseblock.lastPointer) {
                let newblock = new CodeBlockNode(falseblock.scriptid, falseblock.originalindex);
                newblock.mergeBlock(falseblock, false);
                newblock.maxEndIndex = falseblock.maxEndIndex;
                falseblock = newblock;
            }

            let condnode = new BinaryOpStatement(optype, node.originalindex);
            condnode.pushList(node.children);

            let grandparent = parent?.parent;
            if (parent instanceof CodeBlockNode && grandparent instanceof IfStatementNode && grandparent.endblock == parent.branchEndNode) {
                let isor = grandparent.truebranch == trueblock && grandparent.falsebranch == parent;
                let isand = grandparent.falsebranch == falseblock && grandparent.truebranch == parent;
                if (isor || isand) {
                    if (parent.children.length != 1) {
                        parent.remove(node);
                        condnode.pushList(parent.children);
                        //TODO make some sort of in-line codeblock node for this
                        // console.log("merging if statements while 2nd if wasn't parsed completely, stack will be invalid");
                    }
                    let combinedcond = new BinaryOpStatement((isor ? "||" : "&&"), grandparent.originalindex);
                    combinedcond.push(grandparent.statement);
                    combinedcond.push(condnode);
                    if (isor) {
                        grandparent.setBranches(combinedcond, grandparent.truebranch, falseblock, parent.branchEndNode.originalindex);
                    } else {
                        grandparent.setBranches(combinedcond, trueblock, grandparent.falsebranch, parent.branchEndNode.originalindex);
                    }
                    continue;
                }
            }

            let ifstatement = new IfStatementNode(condnode, parent.branchEndNode, trueblock, falseblock, parent.branchEndNode.originalindex);
            cursor.replaceNode(ifstatement);
            cursor.setFirstChild(ifstatement, true);
        }
        if (node instanceof RawOpcodeNode && node.opinfo.id == namedClientScriptOps.switch) {
            if (!(node.parent instanceof CodeBlockNode) || !node.parent.branchEndNode) { throw new Error("code block expected"); }
            let casestatement = new SwitchStatementNode(node, scriptjson, node.parent.possibleSuccessors, node.parent.branchEndNode.originalindex);
            cursor.replaceNode(casestatement);
            cursor.setFirstChild(casestatement, true);
        }
        if (node instanceof RawOpcodeNode && node.opinfo.id == namedClientScriptOps.jump) {
            let target = node.originalindex + 1 + node.op.imm;
            let parent = node.parent;
            if (parent instanceof CodeBlockNode && parent.maxEndIndex == target) {
                //strip obsolete closing bracket jumps
                cursor.remove();
                continue;
            } else {
                for (let ifnode = node.parent; ifnode; ifnode = ifnode.parent) {
                    if (ifnode instanceof IfStatementNode) {
                        let codeblock = ifnode.parent;
                        if (!(codeblock instanceof CodeBlockNode) || !codeblock.parent) { throw new Error("unexpected"); }
                        if (codeblock.originalindex != target) { continue; }
                        if (codeblock.children.at(-1) != ifnode) { throw new Error("unexpected"); }

                        let originalparent = codeblock.parent;
                        let loopstatement = new WhileLoopStatementNode(codeblock, ifnode);
                        originalparent.replaceChild(codeblock, loopstatement);
                        loopstatement.push(ifnode);
                        loopstatement.push(ifnode.truebranch);
                        cursor.rebuildStack();
                        cursor.remove();
                        break;
                    }
                }
            }
        }
        if (node instanceof CodeBlockNode && node.branchEndNode) {
            if (node.maxEndIndex == -1 || node.branchEndNode.originalindex < node.maxEndIndex) {
                let subnode = node.branchEndNode;
                cursor.prev();
                if (subnode.lastPointer) {
                    node.mergeBlock(subnode, false);
                } else {
                    node.mergeBlock(subnode, true);
                }
            }
        }
    }

}

function varArgtype(stringconst: string, lastintconst: number | unknown) {
    //a string like this indicates a vararg set where this string indicates the types
    //treat the entire thing as one vararg
    let varargmatch = stringconst.match(/^([ils]*)Y?$/);
    if (!varargmatch) {
        return null;
    }
    //TODO throw if wrong
    let indiff = new StackList(varargmatch[1].split("").flatMap<StackType>(q => q == "i" ? "int" : q == "l" ? "long" : q == "s" ? "string" : null!));
    //variable number of ints
    if (stringconst.includes("Y")) {
        if (typeof lastintconst != "number") {
            throw new Error("parsing vararg array, but legnth type was not an int");
        }
        for (let i = 0; i < lastintconst; i++) { indiff.int(); }
        indiff.int();//the length of the array on stack
    }
    return indiff;
}

function addKnownStackDiff(section: CodeBlockNode, calli: ClientscriptObfuscation) {
    let consts = new StackConstants();
    let constsknown = true;



    for (let node of section.children) {
        if (!(node instanceof RawOpcodeNode)) {
            continue;
        }

        if (node.opinfo.id == namedClientScriptOps.struct_getparam || node.opinfo.id == namedClientScriptOps.item_getparam) {
            //args are structid/itemid,paramid
            let paramid = consts.values.at(-1);
            if (constsknown && typeof paramid == "number") {
                let param = calli.parammeta.get(paramid);
                if (!param) {
                    console.log("unknown param " + paramid);
                } else {
                    let outtype = (param.type ? typeToPrimitive(param.type.vartype) : "int");
                    node.knownStackDiff = new StackInOut(new StackList(["int", "int"]), new StackList([outtype]));
                }
            }
        } else if (node.opinfo.id == namedClientScriptOps.enum_getvalue) {
            //args are intypeid,outtypeid,enum,lookup
            let outtypeid = consts.values.at(-3);
            if (constsknown && typeof outtypeid == "number") {
                let outtype = typeToPrimitive(outtypeid);
                node.knownStackDiff = new StackInOut(new StackList(["int", "int", "int", "int"]), new StackList([outtype]));
            }
        } else if (node.opinfo.id == namedClientScriptOps.return) {
            let script = calli.scriptargs.get(section.scriptid);
            if (script && script.returns) {
                node.knownStackDiff = new StackInOut(script.returns, new StackList());
            }
        } else if (node.opinfo.id == namedClientScriptOps.gosub) {
            let script = calli.scriptargs.get(node.op.imm);
            if (script && script.arglist && script.returnlist) {
                node.knownStackDiff = new StackInOut(script.arglist, script.returnlist);
            }
        } else if (node.opinfo.id == namedClientScriptOps.joinstring) {
            node.knownStackDiff = new StackInOut(
                new StackList(Array(node.op.imm).fill("string")),
                new StackList(["string"])
            )
        } else if (node.opinfo.id == namedClientScriptOps.pushvar || node.opinfo.id == namedClientScriptOps.popvar) {
            let varmeta = calli.getClientVarMeta(node.op.imm);
            if (varmeta) {
                let ispop = node.opinfo.id == namedClientScriptOps.popvar;

                let value = new StackList([varmeta.type]);
                let other = new StackList();
                node.knownStackDiff = new StackInOut(
                    (ispop ? value : other),
                    (ispop ? other : value)
                );
            }
        } else if (node.opinfo.id == namedClientScriptOps.pushconst) {
            if (node.op.imm == 0) {
                if (typeof node.op.imm_obj != "number") { throw new Error("unexpected"); }
                node.knownStackDiff = new StackInOut(new StackList(), new StackList(["int"]));
                node.knownStackDiff.constout = node.op.imm_obj;
            } else if (node.op.imm == 1) {
                node.knownStackDiff = new StackInOut(new StackList(), new StackList(["long"]));
                node.knownStackDiff.constout = node.op.imm_obj;
            } else if (node.op.imm == 2) {
                let stringconst = node.op.imm_obj as string;
                node.knownStackDiff = new StackInOut(new StackList(), new StackList(["string"]));
                node.knownStackDiff.constout = node.op.imm_obj;

                //a string like this indicates a vararg set where this string indicates the types
                //treat the entire thing as one vararg
                //only make use of this construct if it is at least 3 chars long
                //otherwise ignore the equation
                let varargmatch = stringconst.match(/^([ils]*)Y?$/);
                if (varargmatch && stringconst.length >= 3) {
                    let argtype = varArgtype(stringconst, consts.values.at(-1));
                    if (!argtype) { throw new Error("unexpected"); }
                    node.knownStackDiff = new StackInOut(argtype, new StackList(["vararg"]));
                    node.knownStackDiff.constout = node.op.imm_obj;
                } else if (varargmatch) {
                    node.unknownstack = true;
                    continue;
                }
            } else {
                throw new Error("unexpected");
            }
        }

        if (node.opinfo.id == namedClientScriptOps.pushconst) {
            consts.pushOne(node.op.imm_obj);
        } else if (node.knownStackDiff?.initializedthrough) {
            consts.applyInOut(node.knownStackDiff);
        } else if (node.opinfo.stackinfo.initializedthrough) {
            consts.applyInOut(node.opinfo.stackinfo);
        } else {
            constsknown = false;
        }

        if (!node.knownStackDiff && dynamicOps.includes(node.op.opcode)) {
            node.unknownstack = true;
        }
    }
    // return true;
}

export function generateAst(calli: ClientscriptObfuscation, script: clientscriptdata | clientscript, ops: ClientScriptOp[], scriptid: number) {

    let sections: CodeBlockNode[] = [];
    let getorMakeSection = (index: number) => {
        if (index >= ops.length) { throw new Error("tried to jump outside script"); }
        let section = sections.find(q => q.originalindex == index);
        if (!section) {
            section = new CodeBlockNode(scriptid, index);
            sections.push(section);
        }
        return section
    }

    let currentsection = getorMakeSection(0);

    //find all jump targets and make the sections
    for (let [index, op] of ops.entries()) {
        let nextindex = index + 1;
        let info = calli.decodedMappings.get(op.opcode)!;
        if (!info) { throw new Error("tried to add unknown op to AST"); }

        if (info.id == namedClientScriptOps.jump || branchInstructions.includes(info.id)) {
            let jumpindex = nextindex + op.imm;
            getorMakeSection(nextindex);
            getorMakeSection(jumpindex);
        }
    }

    //write the opcodes
    for (let [index, op] of ops.entries()) {
        let nextindex = index + 1;
        let info = calli.decodedMappings.get(op.opcode)!;
        if (!info) { throw new Error("tried to add unknown op to AST"); }
        let opnode = new RawOpcodeNode(index, op, info);

        //check if other flows merge into this one
        let addrsection = sections.find(q => q.originalindex == index);
        if (addrsection && addrsection != currentsection) {
            currentsection.addSuccessor(addrsection);
            currentsection = addrsection;
        }

        currentsection.push(opnode);

        if (info.id == namedClientScriptOps.jump || branchInstructions.includes(info.id)) {
            let jumpindex = nextindex + op.imm;
            let nextblock = getorMakeSection(nextindex);
            let jumpblock = getorMakeSection(jumpindex);
            if (info.id != namedClientScriptOps.jump) {
                currentsection.addSuccessor(nextblock);
            }
            currentsection.addSuccessor(jumpblock);
            currentsection = nextblock;
        } else if (opnode.opinfo.id == namedClientScriptOps.return) {
            if (index != ops.length - 1) {
                //dead code will be handled elsewhere
                currentsection = getorMakeSection(nextindex);
            }
        } else if (opnode.opinfo.id == namedClientScriptOps.switch) {
            let cases = script.switches[opnode.op.imm];
            if (!cases) { throw new Error("no matching cases in script"); }

            for (let cond of cases) {
                let jumpblock = getorMakeSection(nextindex + cond.label);
                if (!currentsection.possibleSuccessors.includes(jumpblock)) {
                    currentsection.addSuccessor(jumpblock);
                }
            }
            let nextblock = getorMakeSection(nextindex);
            currentsection.addSuccessor(nextblock);
            currentsection = nextblock;
        }
    }
    sections.sort((a, b) => a.originalindex - b.originalindex);
    sections.forEach(q => addKnownStackDiff(q, calli))
    return sections;
}

export async function renderClientScript(source: CacheFileSource, buf: Buffer, fileid: number) {
    let calli = await prepareClientScript(source);
    const full = globalThis.deep ?? true;//TODO remove

    let script = parse.clientscript.read(buf, source);
    let sections = generateAst(calli, script, script.opcodedata, fileid);
    let program = new CodeBlockNode(fileid, 0);
    globalThis[`cs${fileid}`] = program;//TODO remove
    globalThis[`css${fileid}`] = sections;
    if (full) {
        program.addSuccessor(sections[0]);
        for (let node: CodeBlockNode | null = program; node; node = node.findNext());
        sections.forEach(q => translateAst(q));
        fixControlFlow(program, script);
    } else {
        program.pushList(sections);
        for (let node: CodeBlockNode | null = program; node; node = node.findNext());
    }
    let returntype = getReturnType(calli, script.opcodedata);
    let argtype = getArgType(script);
    let res = "";
    res += `script ${fileid} ${returntype} (${argtype})\n`;
    if (full) {
        res += program.getCode(calli, 0);
    } else {
        for (let section of sections) {
            res += section.getCode(calli, 0);
        }
    }
    return res;
}