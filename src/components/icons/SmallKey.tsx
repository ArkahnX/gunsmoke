import CommonKey from "./CommonKey";
import FixedKey from "./FixedKey";

export default function SmallKey(props: { rarity: string, keyType: string }) {
	if(!props.keyType) return null;
	if(props.keyType === "Affinity Key" || props.keyType === "Common Key") {
		return <CommonKey rarity={props.rarity} />
	}
	return <FixedKey rarity={props.rarity} />
}
