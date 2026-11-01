import { KeyType, Rarity } from "../../../gfl2-data/enums";
import CommonKey from "./CommonKey";
import FixedKey from "./FixedKey";

export default function SmallKey(props: { rarity: Rarity; keyType: KeyType }) {
	if (!props.keyType) return null;
	if (props.keyType === KeyType.AffinityKey || props.keyType === KeyType.CommonKey) {
		return <CommonKey rarity={props.rarity} />;
	}
	return <FixedKey rarity={props.rarity} />;
}
