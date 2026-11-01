import { Phase } from "../../../gfl2-data/enums";
import PhaseBurn from "./PhaseBurn";
import PhaseCorrosion from "./PhaseCorrosion";
import PhaseElectric from "./PhaseElectric";
import PhaseFreeze from "./PhaseFreeze";
import PhaseHydro from "./PhaseHydro";
import PhaseOmni from "./PhaseOmni";
import PhasePhysical from "./PhasePhysical";

export default function PhaseIcon(props: { phase: Phase }) {
	switch (props.phase) {
		default:
			return null;
		case Phase.Physical:
			return <PhasePhysical />;
		case Phase.Burn:
			return <PhaseBurn />;
		case Phase.Electric:
			return <PhaseElectric />;
		case Phase.Freeze:
			return <PhaseFreeze />;
		case Phase.Corrosion:
			return <PhaseCorrosion />;
		case Phase.Hydro:
			return <PhaseHydro />;
		case Phase.Resonance:
			return <PhaseOmni />;
	}
}
