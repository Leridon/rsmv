// May or may not be called ob3 :shrug:
import { JMat, JMatInternal } from "./jmat";
import { Stream, packedHSL2HSL, HSL2RGB } from "../utils";
import { cacheMajors } from "../constants";

type Mesh = {
	groupFlags: number;
	unk6: number;
	faceCount: number;
	materialId: number;

	//TODO use arraybuffers here
	colourBuffer: number[];//uint8?
	flag2Buffer: number[];//uint8
	flag4Buffer: number[];//float16 //TODO should be an integer format?
	indexBuffers: number[][];//uin16[]
	vertexBuffer: number[];//int16 //is actually position buffer
	normalBuffer: number[];//int8
	tangentBuffer: number[];//int8 //normals and tangent?
	uvBuffer: number[]//float16
	flag8Buffer: number[]//float16

	indexBufferCount: number;
	vertexCount: number;

	material: JMatInternal;
	textures: { [key: string]: number | Texture };
	specular: number;
	metalness: number;
	colour: number;
}

type Texture = HTMLImageElement & {
	isReady: boolean;
	parents: OB3[];
	id: string;//TODO actually sets id of HtmlElement and possibly messes up document.getElementById
};

export class OB3 {
	getFile: (major: number, minor: number) => Promise<Buffer>;

	format = 2;
	version = 0;
	materialGroupCount = 0;
	materialGroups: Mesh[] = [];
	textures: { [id: number]: Texture } = {};
	unk1 = 0;
	unkCount0 = 0;
	unkCount1 = 0;
	unkCount2 = 0;
	particlePoolCount;
	unk2;
	model: any = null;
	onfinishedloading: (() => void) | (() => void)[] = [];
	constructor(getFile: (major: number, minor: number) => Promise<Buffer>) {
		this.getFile = getFile;
	}

	setData(data: Buffer) {
		this.model = new Stream(data);
		this.parse();
	}

	getVersion() {
		return this.version;
	}

	getMaterialGroups() {
		return this.materialGroups;
	}

	getPretty() {
		return {
			"___format": this.format,
			"___unk1": this.unk1,
			"___version": this.version,
			"__materialGroupCount": this.materialGroupCount,
			"__unkCount1": this.unk2,
			"_particlePoolCount": this.particlePoolCount,
			"materialGroups": this.getMaterialGroups()
		};
	}

	checkReady() {
		for (var g = 0; g < this.materialGroups.length; ++g) {
			for (var i in this.materialGroups[g].textures) {
				let tex = this.materialGroups[g].textures[i]
				if (typeof tex != "object" || !tex.isReady)
					return false;
			}
		}
		if (typeof this.onfinishedloading == "function")
			this.onfinishedloading();
		else if (typeof this.onfinishedloading == "object")
			for (var i in this.onfinishedloading)
				this.onfinishedloading[i]();
		else
			console.log("WebGLoop.ob3.js: OnFinishedLoading event corrupted by an external library");
		return true;
	}

	loadTexture(texId: number) {
		let tex = this.textures[texId];
		if (!tex) {
			tex = new Image() as any;
			this.textures[texId] = tex;
			tex.id = "" + texId; // Just for bookkeeping
			tex.isReady = false;
			tex.parents = [];
			tex.onload = function (this: Texture) {
				URL.revokeObjectURL(this.src);
				this.isReady = true;
				this.parents.forEach(p => p.checkReady());
			};
			this.getFile(cacheMajors.textures, texId).then(texfile => {
				let blob = new Blob([texfile], { type: "image/png" });
				tex.src = URL.createObjectURL(blob);
			});
		}
		return tex;
	}

	async loadMaterials() {
		for (var g = 0; g < this.materialGroups.length; ++g) {
			if (this.materialGroups[g].materialId == 0)
				continue;

			var material = await this.getFile(cacheMajors.materials, this.materialGroups[g].materialId - 1);
			var materialGroup = this.materialGroups[g];

			if (material[0] == 0x00) {
				var mat = new JMat(material).get();
				materialGroup.material = mat;
				console.log(mat);
				materialGroup.textures["diffuse"] = mat.maps["diffuseId"];
				materialGroup.specular = mat.specular;
				materialGroup.metalness = mat.metalness;
				materialGroup.colour = mat.colour;
			}
			else if (material[0] == 0x01) {
				var mat = new JMat(material).get();
				materialGroup.material = mat;
				console.log(mat);
				if (mat.flags.hasDiffuse)
					materialGroup.textures["diffuse"] = mat.maps["diffuseId"];
				if (mat.flags.hasNormal)
					materialGroup.textures["normal"] = mat.maps["normalId"];
				if (mat.flags.hasCompound)
					materialGroup.textures["compound"] = mat.maps["compoundId"];
			}
			materialGroup.textures["environment"] = 5522;
			for (var i in materialGroup.textures) {
				var texId = materialGroup.textures[i];
				if (typeof texId != "string" && typeof texId != "number") { continue; }
				let tex = this.loadTexture(texId);
				tex.parents.push(this);
				materialGroup.textures[i] = tex;
			}
		}
		this.checkReady();
	}

	parse() {
		this.format = this.model.readByte();              // Format number
		this.unk1 = this.model.readByte();                // Unknown, always 03?
		this.version = this.model.readByte();             // Version
		this.materialGroupCount = this.model.readUByte(); // Material group count
		this.unkCount0 = this.model.readUByte();          // Unknown
		this.unkCount1 = this.model.readUByte();          // Unknown
		this.unkCount2 = this.model.readUShort();         // Unknown
		var model = this.model;

		for (var n = 0; n < this.materialGroupCount; ++n) {
			var group: Mesh = {} as any;
			group.groupFlags = this.model.readUInt();        // Group flags, determines what buffers to read             // Flag 0x10 is currently used, but doesn't appear to change the structure or data in any way

			group.unk6 = this.model.readUByte();             // Unknown, probably pertains to materials
			group.materialId = this.model.readUShort();      // Material id
			group.faceCount = this.model.readUShort();       // Face count

			group.textures = {};

			if ((group.groupFlags & 0x01) == 0x01)      //      (Colour buffer flag is set)
			{
				group.colourBuffer = [];
				for (var i = 0; i < group.faceCount; ++i) {
					var faceColour = model.readUShort();        // Face colour
					if (faceColour == 39834)
						faceColour = 43220;
					//var colour = HSL2RGB(packedHSL2HSL(faceColour));
					var colour = packedHSL2HSL(faceColour);
					for (var j = 0; j < 3; ++j)
						group.colourBuffer.push(colour[j]);
				}
			}
			if ((group.groupFlags & 0x02) == 0x02)      //      (Unknown, flag 0x02)
			{
				group.flag2Buffer = [];
				for (var i = 0; i < group.faceCount; ++i)
					group.flag2Buffer.push(model.readByte());   // Unknown
			}
			if ((group.groupFlags & 0x04) == 0x04)      //      (Unknown, flag 0x04)
			{
				group.flag4Buffer = [];
				for (var i = 0; i < group.faceCount; ++i)
					group.flag4Buffer.push(model.readHalf()); // Unknown
			}

			group.indexBufferCount = model.readUByte(); // Index buffer count
			group.indexBuffers = [];
			for (var i = 0; i < group.indexBufferCount; ++i) {
				var indexCount = model.readUShort();        // Index count
				var indices: number[] = [];
				for (var j = 0; j < indexCount; ++j)
					indices.push(model.readUShort());           // Index
				group.indexBuffers.push(indices);
			}

			if ((group.groupFlags & 0x01) == 0x01 || (group.groupFlags & 0x08) == 0x08) {
				group.vertexCount = model.readUShort();     // Vertex count
				if ((group.groupFlags & 0x01) == 0x01) {
					group.vertexBuffer = [];                        // Vertices
					for (var i = 0; i < group.vertexCount; ++i) {
						group.vertexBuffer.push(model.readShort()); // Vertex x
						group.vertexBuffer.push(model.readShort()); // Vertex y
						group.vertexBuffer.push(-model.readShort());// Vertex z (negate this so it's right-handed so we can transform it into left-handed so OpenGL can convert it to right-handed. fuck. me.)
					}
					group.normalBuffer = [];                    // Normals
					for (var i = 0; i < group.vertexCount; ++i) {
						group.normalBuffer.push(model.readByte() / 127); // Normal x
						group.normalBuffer.push(model.readByte() / 127); // Normal y
						group.normalBuffer.push(-model.readByte() / 127); // Normal z
					}
					group.tangentBuffer = [];                   // Tangents
					for (var i = 0; i < group.vertexCount; ++i) {
						group.tangentBuffer.push(model.readByte() / 127); // Tangent x
						group.tangentBuffer.push(model.readByte() / 127); // Tangent y
						group.tangentBuffer.push(model.readByte() / 127); // Tangent z
						group.tangentBuffer.push(model.readByte() / 127); // Tangent w
					}
					group.uvBuffer = [];                        // UV coordinates
					for (var i = 0; i < group.vertexCount; ++i) {
						group.uvBuffer.push(model.readHalf());      // U
						group.uvBuffer.push(model.readHalf());      // V
					}
				}
				if ((group.groupFlags & 0x08) == 0x08) {
					group.flag8Buffer = [];                     // Vertices
					for (var i = 0; i < group.vertexCount; ++i)
						group.flag8Buffer.push(model.readHalf()); // Vertex x
				}
			}

			this.materialGroups.push(group);
		}
		//console.log(groups);
		//console.log("0x" + model.scanloc().toString(16).toUpperCase());
	}
}
