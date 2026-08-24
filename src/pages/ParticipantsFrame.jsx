import ParticipantCsvImport from '../components/ParticipantCsvImport';
import '../components/ParticipantCsvImport.css';
import Participants from './Participants';

export default function ParticipantsFrame() {
  return (
    <div className="lexams-participants-frame">
      <div className="lexams-participants-import-slot"><ParticipantCsvImport /></div>
      <Participants />
    </div>
  );
}
