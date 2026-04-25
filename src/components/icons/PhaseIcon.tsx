import PhaseBurn from "./PhaseBurn";
import PhaseCorrosion from "./PhaseCorrosion";
import PhaseElectric from "./PhaseElectric";
import PhaseFreeze from "./PhaseFreeze";
import PhaseHydro from "./PhaseHydro";
import PhaseOmni from "./PhaseOmni";
import PhasePhysical from "./PhasePhysical";

export default function PhaseIcon(props:{phase:string}) {
	switch (props.phase.toLowerCase()) {
		default:
			return null;
		case "physical":
			return <PhasePhysical />;
			case "burn":
				return <PhaseBurn />;
		case "electric":
			return <PhaseElectric />;
		case "freeze":
			return <PhaseFreeze />;
		case "corrosion":
			return <PhaseCorrosion />;
		case "hydro":
			return <PhaseHydro />;
		case "omni":
			return <PhaseOmni />;
	}
}
