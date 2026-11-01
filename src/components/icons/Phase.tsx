import All from "./All";
import Burn from "./Burn";
import Corrosion from "./Corrosion";
import Electric from "./Electric";
import Freeze from "./Freeze";
import Hydro from "./Hydro";
import Omni from "./Omni";
import Physical from "./Physical";
import { Phase as PhaseEnum } from "../../../gfl2-data/enums";

export default function Phase(props: { phase: PhaseEnum; fill?: string }) {
	switch (props.phase) {
		default:
			return <All fill={props.fill} />;
		case PhaseEnum.Physical:
			return <Physical fill={props.fill} />;
		case PhaseEnum.Burn:
			return <Burn fill={props.fill} />;
		case PhaseEnum.Electric:
			return <Electric fill={props.fill} />;
		case PhaseEnum.Freeze:
			return <Freeze fill={props.fill} />;
		case PhaseEnum.Corrosion:
			return <Corrosion fill={props.fill} />;
		case PhaseEnum.Hydro:
			return <Hydro fill={props.fill} />;
		case PhaseEnum.Resonance:
			return <Omni fill={props.fill} />;
	}
}
