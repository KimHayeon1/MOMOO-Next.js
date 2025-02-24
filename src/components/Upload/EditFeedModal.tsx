import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import { SyntheticEvent, useEffect, useRef, useState } from 'react';

import Accordion from '@/components/Accordion/Accordion';
import MultipleAccordion from '@/components/Accordion/MultipleAccordion';
import Preview from '@/components/FileUpload/Preview';
import { StyledLoadingImg } from '@/components/Loading/StyledLodingImg';
import KakaoMap from '@/components/Map/KakaoMap';
import GetAccordionData from '@/components/Upload/GetAccordionData';
import * as Styled from '@/components/Upload/Upload/StyledUpload';
import uploadImageToStorage from '@/components/Upload/UploadImageToStorage';
import useAuthContext from '@/hooks/useAuthContext';
import useEditContext from '@/hooks/useEditContext';
import useEditFeed from '@/hooks/useEditFeed';
import useGetFeedData from '@/hooks/useGetFeedData';
import useGetSavedAlbumList from '@/hooks/useGetSavedAlbumList';
import {
  useAddFeedIdFromFeedList,
  useRemoveFeedIdFromFeedList,
} from '@/hooks/useUpdateFeedList';
import { deleteImg } from '@/utils/SDKUtils';

interface AccordionData {
  question: string;
  answer: string[];
}

interface AlbumIdData {
  albumName: string;
  docId: string;
}

export default function EditFeedModal() {
  const [kakaoMapVisible, setKakaoMapVisible] = useState(false);
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [selectedAlbumList, setSelectedAlbumList] = useState<string[]>([]);
  const [savedAlbumList, setSavedAlbumList] = useState<string[]>([]);
  const [selectedAddress, setSelectedAddress] = useState('');
  const [selectedWeatherImage, setSelectedWeatherImage] = useState<string>('');
  const [selectedEmotionImage, setSelectedEmotionImage] = useState<string>('');
  const [file, setFile] = useState<FileList | null>(null);
  const [imgUrlList, setImgUrlList] = useState([]);
  const getFeedData = useGetFeedData();
  const [accordionData, setAccordionData] = useState<AccordionData[]>([]);
  const [albumIdData, setAlbumIdData] = useState<AlbumIdData[]>([]);
  const [isPending, setIsPending] = useState(false);

  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const router = useRouter();
  const { album } = useParams<{ album: string }>();

  const { user } = useAuthContext();
  const { setIsEditModalOpen, feedIdToEdit, setFeedIdToEdit } =
    useEditContext();

  const getAccordionData = GetAccordionData();
  const editFeed = useEditFeed();
  const getSavedAlbumList = useGetSavedAlbumList();
  const addFeedIdFromFeedList = useAddFeedIdFromFeedList();
  const removeFeedIdFromFeedList = useRemoveFeedIdFromFeedList();

  useEffect(() => {
    const setFeedData = async () => {
      const data = await getFeedData(feedIdToEdit);

      if (data) {
        setTitle(data.title);
        setText(data.text);
        setSelectedAddress(data.selectedAddress);
        setSelectedWeatherImage(data.weatherImage);
        setSelectedEmotionImage(data.emotionImage);
        setImgUrlList(data.imageUrl);
      }
    };

    const setSavedAlbumData = async () => {
      const data = await getSavedAlbumList(feedIdToEdit);

      if (data) {
        setSelectedAlbumList(data.map((v) => v.data().name));
        setSavedAlbumList(data.map((v) => v.id));
      }
    };

    const SetAccordionData = async () => {
      if (user) {
        const result = await getAccordionData();
        setAccordionData(result.accordionData || []);
        setAlbumIdData(result.albumIdData || []);
      }
    };

    setFeedData();
    setSavedAlbumData();
    SetAccordionData();
  }, []);

  if (!user) {
    router.push('/');
    return;
  }

  const toggleKakaoMap = () => {
    setKakaoMapVisible(!kakaoMapVisible);
  };

  const closeEditFeedModal = () => {
    setIsEditModalOpen(false);
    setFeedIdToEdit('');
  };

  const handleAddressSelect = (selectedAddress: string) => {
    setSelectedAddress(selectedAddress);
  };

  const handleSubmit = async (e: SyntheticEvent) => {
    e.preventDefault();

    if (title.trim() === '') {
      alert('제목을 입력해 주세요');
      return;
    }

    try {
      setIsPending(true);

      let downloadURLs: string[] = imgUrlList;

      if (file !== null) {
        downloadURLs = await uploadImageToStorage(
          file,
          `feed/${user.uid}`,
          feedIdToEdit,
        );
      }

      const editData = {
        title: title,
        text: text,
        selectedAddress: selectedAddress,
        weatherImage: selectedWeatherImage,
        emotionImage: selectedEmotionImage,
        imageUrl: downloadURLs,
      };

      await editFeed(editData);

      selectedAlbumList.forEach(async (selectedAlbumName) => {
        let selectedAlbumId = '';

        for (const iterator of albumIdData) {
          if (selectedAlbumName === iterator.albumName) {
            selectedAlbumId = iterator.docId;
          }
        }

        if (!savedAlbumList.includes(selectedAlbumId)) {
          await addFeedIdFromFeedList(feedIdToEdit, selectedAlbumId);
        }
      });

      savedAlbumList.forEach(async (savedAlbumId) => {
        let savedAlbumName = '';

        for (const iterator of albumIdData) {
          if (savedAlbumId === iterator.docId) {
            savedAlbumName = iterator.albumName;
          }
        }

        if (!selectedAlbumList.includes(savedAlbumName)) {
          await removeFeedIdFromFeedList(feedIdToEdit, savedAlbumId);
        }
      });

      // 이미지 삭제 실패 시, 게시물 수정이 중단되지 않도록 try 마지막에 위치
      if (file !== null) {
        for (let i = downloadURLs.length; i < 3; i++)
          if (!downloadURLs.includes(imgUrlList[i])) {
            await deleteImg(imgUrlList[i]);
          }
      }
    } catch (error) {
      console.error(error);
    }

    setIsPending(false);
    const albumName =
      album && selectedAlbumList.includes(album) ? album : selectedAlbumList[0];
    router.push(`/${user.uid}/${albumName}/p/${feedIdToEdit}`);
    closeEditFeedModal();
  };

  return (
    <>
      <Styled.StyledDialog
        className={isPending ? 'loading' : ''}
        ref={(node) => {
          if (node && !dialogRef.current) {
            node.showModal();
            dialogRef.current = node;
          }
        }}
      >
        <Styled.UploadHeader>
          <h2>게시물 수정</h2>
          <button className="uploadBtn" type="submit" onClick={handleSubmit}>
            완료
          </button>
        </Styled.UploadHeader>
        <Styled.UploadContents>
          {isPending ? (
            <StyledLoadingImg
              src="/icons/loading.svg"
              alt="로딩중"
              width={36}
              height={36}
            />
          ) : (
            <>
              <Styled.PicPart>
                <Preview setFile={setFile} imgUrlList={imgUrlList} />
              </Styled.PicPart>
              <Styled.SelectPart>
                <div className="inputWrapper">
                  <input
                    type="text"
                    placeholder="제목을 입력해 주세요 (필수)"
                    value={title}
                    onChange={(e) => {
                      setTitle(e.target.value);
                    }}
                    required
                  />
                </div>
                <form className="uploadInfo">
                  <textarea
                    id="uploadText"
                    maxLength={1000}
                    cols={30}
                    rows={10}
                    value={text}
                    onChange={(e) => {
                      setText(e.target.value);
                    }}
                    placeholder="문구를 입력해 주세요"
                  ></textarea>
                </form>
                <Styled.LocationContents onClick={toggleKakaoMap}>
                  <div className="locationHead">
                    {selectedAddress ? (
                      <p>선택한 주소: {selectedAddress}</p>
                    ) : (
                      <h2>위치 추가</h2>
                    )}
                    <Image
                      className={kakaoMapVisible ? 'rotate' : ''}
                      src="/icons/arrow.svg"
                      width={16}
                      height={16}
                      alt={'위치토글아이콘'}
                    ></Image>
                  </div>
                </Styled.LocationContents>
                {kakaoMapVisible && (
                  <Styled.KakaoMapContainer>
                    <KakaoMap
                      onAddressSelect={(address) =>
                        handleAddressSelect(address)
                      }
                    />
                  </Styled.KakaoMapContainer>
                )}
                <Styled.AccordionContents>
                  {accordionData.slice(1, 2).map(() => (
                    <MultipleAccordion
                      key={0}
                      question={accordionData[0].question}
                      answer={accordionData[0].answer.join(',')}
                      selectedAlbum={selectedAlbumList}
                      setSelectedAlbum={setSelectedAlbumList}
                    />
                  ))}
                  {accordionData.slice(1, 3).map((data, index) => (
                    <Accordion
                      key={index}
                      question={data.question}
                      answer={data.answer.join(',')}
                      selectedImages={
                        data.question === '오늘의 날씨'
                          ? selectedWeatherImage
                          : selectedEmotionImage
                      }
                      setSelectedImages={
                        data.question === '오늘의 날씨'
                          ? setSelectedWeatherImage
                          : setSelectedEmotionImage
                      }
                    />
                  ))}
                </Styled.AccordionContents>
              </Styled.SelectPart>
            </>
          )}
        </Styled.UploadContents>
        <Styled.CloseBtn className="closeBtn" onClick={closeEditFeedModal}>
          <Image
            className={kakaoMapVisible ? 'rotate' : ''}
            src="/icons/x-white.svg"
            width={24}
            height={24}
            alt={'닫기'}
          ></Image>
        </Styled.CloseBtn>
      </Styled.StyledDialog>
    </>
  );
}
