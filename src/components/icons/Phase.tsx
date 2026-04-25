import All from "./All";
import Burn from "./Burn";
import Corrosion from "./Corrosion";
import Electric from "./Electric";
import Freeze from "./Freeze";
import Hydro from "./Hydro";
import Omni from "./Omni";
import Physical from "./Physical";

export default function Phase(props:{phase:string, fill?:string}) {
	switch (props.phase.toLowerCase()) {
		default:
			return <All fill={props.fill} />;
		case "physical":
			return <Physical fill={props.fill} />;
			case "burn":
				return <Burn fill={props.fill} />;
		case "electric":
			return <Electric fill={props.fill} />;
		case "freeze":
			return <Freeze fill={props.fill} />;
		case "corrosion":
			return <Corrosion fill={props.fill} />;
		case "hydro":
			return <Hydro fill={props.fill} />;
		case "omni":
			return <Omni fill={props.fill} />;
	}
}
